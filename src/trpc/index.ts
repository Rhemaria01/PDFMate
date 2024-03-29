import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import {
  adminProcedure,
  privateProcedure,
  publicProcedure,
  router,
} from "./trpc";
import { TRPCError } from "@trpc/server";
import { db } from "@/db";
import { z } from "zod";
import { INFINITE_QUERY_LIMIT } from "@/config/infinite-query";
import { absoluteUrl } from "@/lib/utils";
import { getUserSubscriptionPlan, stripe } from "@/lib/stripe";
import { PLANS } from "@/config/stripe";
import { getPineconeClient } from "@/lib/pinecone";
import { utapi } from "uploadthing/server";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { PineconeStore } from "langchain/vectorstores/pinecone";

export const appRouter = router({
  authCallback: publicProcedure.query(async () => {
    const { getUser } = getKindeServerSession();
    const user = getUser();

    if (!user.id || !user.email) throw new TRPCError({ code: "UNAUTHORIZED" });

    // check if the user is in the database
    const dbUser = await db.user.findFirst({
      where: {
        id: user.id,
      },
    });

    if (!dbUser) {
      // create user in db
      await db.user.create({
        data: {
          id: user.id,
          email: user.email,
        },
      });
    }

    return { success: true };
  }),

  getUserFiles: privateProcedure.query(async ({ ctx }) => {
    const { userId } = ctx;
    const files = await db.file.findMany({
      where: {
        userId,
      },
    });

    return files;
  }),

  getUserQuota: privateProcedure.mutation(async ({ ctx }) => {
    const { userId } = ctx;
    const files = await db.file.findMany({
      where: {
        userId,
      },
    });
    const subscriptionPlan = await getUserSubscriptionPlan();

    const quota =
      PLANS.find((plan) => plan.name === subscriptionPlan.name)?.quota ??
      PLANS[0].quota;

    let isQuotaCompleted =
      files.filter(
        (file) =>
          file.createdAt.getMonth() === new Date().getMonth() &&
          file.createdAt.getFullYear() === new Date().getFullYear()
      ).length >= quota;

    return isQuotaCompleted;
  }),

  createStripeSession: privateProcedure.mutation(async ({ ctx }) => {
    const { userId } = ctx;

    const billingUrl = absoluteUrl("/dashboard/billing");

    if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

    const dbUser = await db.user.findFirst({
      where: {
        id: userId,
      },
    });

    if (!dbUser) throw new TRPCError({ code: "UNAUTHORIZED" });

    const subscriptionPlan = await getUserSubscriptionPlan();

    if (subscriptionPlan.isSubscribed && dbUser.stripeCustomerID) {
      const stripeSession = await stripe.billingPortal.sessions.create({
        customer: dbUser.stripeCustomerID,
        return_url: billingUrl,
      });

      return { url: stripeSession.url };
    }

    const stripeSession = await stripe.checkout.sessions.create({
      success_url: billingUrl,
      cancel_url: billingUrl,
      payment_method_types: ["card"],
      mode: "subscription",
      billing_address_collection: "auto",
      line_items: [
        {
          price: PLANS.find((plan) => plan.name === "Pro")?.price.priceIds
            .production,
          quantity: 1,
        },
      ],
      metadata: {
        userId: userId,
      },
    });

    return { url: stripeSession.url };
  }),

  getFileMessages: privateProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).nullish(),
        cursor: z.string().nullish(),
        fileId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { userId } = ctx;
      const { fileId, cursor } = input;
      const limit = input.limit ?? INFINITE_QUERY_LIMIT;

      const file = await db.file.findFirst({
        where: {
          id: fileId,
          userId,
        },
      });

      if (!file) throw new TRPCError({ code: "NOT_FOUND" });

      const messages = await db.message.findMany({
        take: limit + 1,
        where: {
          fileId,
        },
        orderBy: {
          createdAt: "desc",
        },
        cursor: cursor ? { id: cursor } : undefined,
        select: {
          id: true,
          isUserMessage: true,
          createdAt: true,
          text: true,
        },
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (messages.length > limit) {
        const nextItem = messages.pop();
        nextCursor = nextItem?.id;
      }

      return {
        messages,
        nextCursor,
      };
    }),

  getMessageCount: privateProcedure
    .input(z.object({ fileId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { userId } = ctx;
      const { fileId } = input;
      const file = await db.file.findFirst({
        where: {
          id: fileId,
          userId,
        },
      });

      if (!file) throw new TRPCError({ code: "NOT_FOUND" });

      const messageCount = await db.message.count({
        where: {
          fileId,
        },
      });

      return messageCount;
    }),

  getFileUploadStatus: privateProcedure
    .input(z.object({ fileId: z.string() }))
    .query(async ({ input, ctx }) => {
      const file = await db.file.findFirst({
        where: {
          id: input.fileId,
          userId: ctx.userId,
        },
      });

      if (!file) return { status: "PENDING" as const };

      return { status: file.uploadStatus };
    }),

  getFile: privateProcedure
    .input(z.object({ key: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;

      const file = await db.file.findFirst({
        where: {
          key: input.key,
          userId,
        },
      });

      if (!file) throw new TRPCError({ code: "NOT_FOUND" });
      return file;
    }),

  deleteFile: privateProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;

      const file = await db.file.findFirst({
        where: {
          id: input.id,
          userId,
        },
      });

      if (!file) throw new TRPCError({ code: "NOT_FOUND" });

      await db.message.deleteMany({
        where: {
          fileId: input.id,
        },
      });

      await db.file.delete({
        where: {
          id: input.id,
        },
      });

      await utapi.deleteFiles(file.key);

      const pinecone = await getPineconeClient();
      const pineconeIndex = pinecone.Index("pdfmate");

      await pineconeIndex.delete1({
        deleteAll: true,
        namespace: input.id,
      });

      return file;
    }),

  addFilesDataToDb: privateProcedure
    .input(z.object({ key: z.string(), url: z.string(), name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { key, url, name } = input;
      const { userId } = ctx;
      const isFileExist = await db.file.findFirst({
        where: {
          key: key,
        },
      });

      if (isFileExist)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "File already exists",
        });
      const createdFile = await db.file.create({
        data: {
          key: key,
          name: name,
          userId: userId,
          url: `https://uploadthing-prod.s3.us-west-2.amazonaws.com/${key}`,
          uploadStatus: "PROCESSING",
        },
      });

      try {
        const response = await fetch(
          `https://uploadthing-prod.s3.us-west-2.amazonaws.com/${key}`
        );

        const blob = await response.blob();

        const loader = new PDFLoader(blob);

        const pageLevelDocs = await loader.load();

        const pagesAmt = pageLevelDocs.length;

        const subscriptionPlan = await getUserSubscriptionPlan();

        const { isSubscribed } = subscriptionPlan;

        const isProExceeded =
          pagesAmt > PLANS.find((plan) => plan.name === "Pro")!.pagePerPdf;
        const isFreeExceeded =
          pagesAmt > PLANS.find((plan) => plan.name === "Free")!.pagePerPdf;
        const isAdmin = userId === process.env.ADMIN_ID;

        if (
          !isAdmin &&
          ((isSubscribed && isProExceeded) || (!isSubscribed && isFreeExceeded))
        ) {
          await db.file.update({
            data: {
              uploadStatus: "FAILED",
            },
            where: {
              id: createdFile.id,
            },
          });
          return;
        }

        const pinecone = await getPineconeClient();
        const pineconeIndex = pinecone.Index("pdfmate");

        const embeddings = new OpenAIEmbeddings({
          openAIApiKey: process.env.OPENAI_API_KEY,
        });

        await PineconeStore.fromDocuments(pageLevelDocs, embeddings, {
          pineconeIndex,
          namespace: createdFile.id,
        });

        await db.file.update({
          data: {
            uploadStatus: "SUCCESS",
          },
          where: {
            id: createdFile.id,
          },
        });
      } catch (error) {
        console.log(error);

        await db.file.update({
          data: {
            uploadStatus: "FAILED",
          },
          where: {
            id: createdFile.id,
          },
        });
      }
    }),

  deleteFileFromEverywhere: adminProcedure
    .input(z.object({ fileId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;
      if (userId !== process.env.ADMIN_ID)
        throw new TRPCError({ code: "UNAUTHORIZED" });

      const pinecone = await getPineconeClient();
      const pineconeIndex = pinecone.Index("pdfmate");

      const { fileId } = input;

      const fileKey = await db.file.findFirst({
        where: {
          id: fileId,
        },
        select: {
          key: true,
        },
      });

      if (!fileKey)
        return {
          title: "No such File",
          description: `No file with Id: ${fileId}`,
        };

      if (fileId && fileKey?.key) {
        try {
          await pineconeIndex.delete1({
            deleteAll: true,
            namespace: fileId,
          });
        } catch (error) {
          console.log(error, "from pinecone");
          return {
            title: "Error Deleting",
            description: `Error Deleting: ${fileId} from pinecone`,
          };
        }

        try {
          await utapi.deleteFiles(fileKey?.key);
        } catch (error) {
          console.log(error, "from uploadthing");
          return {
            title: "Error Deleting",
            description: `Error Deleting: ${fileId} from uploadthing`,
          };
        }
        let data;
        try {
          await db.message.deleteMany({
            where: {
              fileId,
            },
          });
          data = await db.file.delete({
            where: {
              id: fileId,
            },
          });
        } catch (error) {
          console.log(error, "from Database");
          return {
            title: "Error Deleting",
            description: `Error Deleting: ${fileId} from database`,
          };
        }
        return {
          title: "Deleted Successfully",
          description: `Deleted file ${data?.name} from Pinecone, Uploadthing and Database.
          Also Deleted Chat with the file`,
        };
      }
      return {
        title: "Something went wrong",
        description: "Not able to catch the error",
      };
    }),
});

export type AppRouter = typeof appRouter;
