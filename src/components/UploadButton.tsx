"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "./ui/dialog";
import { Button } from "./ui/button";

import Dropzone from "react-dropzone";
import { Cloud, File, Loader2, XCircle } from "lucide-react";
import { Progress } from "./ui/progress";
import { setInterval } from "timers";
import { useUploadThing } from "@/lib/uploadthing";
import { useToast } from "./ui/use-toast";
import { trpc } from "@/app/_trpc/client";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import Link from "next/link";
import Skeleton from "react-loading-skeleton";

const UploadDropzone = ({ isSubscribed }: { isSubscribed: boolean }) => {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  type isFailedType = {
    status: boolean;
    message: string;
  };
  const [isFailed, setIsFailed] = useState<isFailedType>({
    status: false,
    message: "",
  });

  const { toast } = useToast();

  const { startUpload } = useUploadThing(
    isSubscribed ? "proPlanUploader" : "freePlanUploader"
  );
  const { mutate: startPolling } = trpc.getFile.useMutation({
    onSuccess: (file) => {
      router.push(`/dashboard/${file.id}`);
    },
    retry: true,
    retryDelay: 500,
  });
  const startSimulatedProgress = () => {
    setUploadProgress(0);
    setIsFailed({
      status: false,
      message: "",
    });
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          return prev;
        }
        return prev + 5;
      });
    }, 500);

    return interval;
  };
  return (
    <Dropzone
      multiple={false}
      onDrop={async (acceptedFile) => {
        setIsUploading(true);

        const progressInterval = startSimulatedProgress();

        const res = await startUpload(acceptedFile);

        if (!res) {
          setIsFailed({
            status: true,
            message: `Only accepts file of size ${
              isSubscribed ? "16" : "4"
            }mb or less.`,
          });

          return toast({
            title: "Plan Exceeded",
            description:
              "Attempting to upload file which exceeds the size limit permitted by your subscription plan.",
            variant: "destructive",
          });
        }

        const [fileResponse] = res;

        const key = fileResponse?.key;

        if (!key) {
          return toast({
            title: "Something went wrong!",
            description: "Please try again later",
            variant: "destructive",
          });
        }

        clearInterval(progressInterval);
        setUploadProgress(100);

        startPolling({ key });
      }}>
      {({ getRootProps, getInputProps, acceptedFiles }) => (
        <div
          {...getRootProps()}
          className="border h-64 m-4 border-dashed border-gray-300">
          <div className="flex items-center justify-center h-full w-full">
            <input
              type="file"
              id="dropzone-file"
              className="hidden"
              {...getInputProps()}
            />
            <div className="flex flex-col items-center justify-center w-full h-full cursor-pointer bg-gray-50 hover:bg-gray-100">
              <div className="flex flex-col items-center justify-center pt-5 pb-6 ">
                <Cloud className="h-6 w-6 text-zinc-500 mb-2" />
                <p className="mb-2 text-sm text-zinc-700">
                  <span className="font-semibold">Click to upload</span>
                  {"   "}
                  or drag and drop
                </p>
                <p className="text-xs text-zinc-500">
                  PDF (up to {isSubscribed ? "16" : "4"}MB)
                </p>
              </div>
              {acceptedFiles && acceptedFiles[0] ? (
                <div className="max-w-xs bg-white flex items-center rounded-md  overflow-hidden outline outline-[1px] outline-zinc-200 divide-x divide-zinc-200">
                  <div className="px-3 py-2 h-full grid place-items-center">
                    <File className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="px-3 py-2 h-full text-sm truncate">
                    {acceptedFiles[0].name}
                  </div>
                </div>
              ) : null}

              {isUploading && !isFailed.status ? (
                <div className="w-full mt-4 max-w-xs mx-auto">
                  <Progress
                    indicatorColor={
                      uploadProgress === 100 ? "bg-green-500" : ""
                    }
                    value={uploadProgress}
                    className="h-1 w-full bg-zinc-200"
                  />
                  {uploadProgress === 100 ? (
                    <div className="flex gap-1 items-center justify-center text-sm text-zinc-700 text-center pt-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Redirecting....
                    </div>
                  ) : null}
                </div>
              ) : null}
              {isFailed.status ? (
                <div className="flex gap-1 items-center justify-center text-sm text-zinc-700 text-center pt-2">
                  <XCircle className="h-5 w-5 text-red-400" />
                  {isFailed.message}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </Dropzone>
  );
};

interface UploadButtonProps {
  isSubscribed: boolean;
  isAdmin: boolean;
}
const UploadButton = ({ isSubscribed, isAdmin }: UploadButtonProps) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const {
    mutate: getUserQuota,
    data: isQuotaExceeded,
    isLoading: isQuotaLoading,
  } = trpc.getUserQuota.useMutation();

  const handleClick = async () => {
    await getUserQuota();
    setIsOpen(true);
  };
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => {
        if (!v) {
          setIsOpen(v);
        }
      }}>
      <DialogTrigger onClick={handleClick} asChild>
        <Button>
          {" "}
          {isQuotaLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Upload PDF"
          )}
        </Button>
      </DialogTrigger>

      <DialogContent>
        {isQuotaLoading ? (
          <div className="m-4">
            <Skeleton className="h-64 rounded-lg" />
          </div>
        ) : isQuotaExceeded && !isAdmin ? (
          <div className="flex items-center justify-center h-64 m-4">
            <div className="flex flex-col gap-1 items-center h-full w-full justify-center text-base text-zinc-700 text-center pt-2">
              <p className="text-2xl text-black flex gap-x-2 items-center justify-center mb-5">
                <XCircle className="h-6 w-6 text-red-400" />
                File Amount Exceeded
              </p>
              <p>
                You are currently on{" "}
                <span className="font-bold">
                  {isSubscribed ? "Pro" : "Free"}
                </span>{" "}
                plan.
              </p>
              <p className="text-sm">
                {" "}
                So you can&apos;t upload more than{" "}
                <span className="font-bold">
                  {isSubscribed ? "50" : "10"}
                </span>{" "}
                files in a month.{" "}
              </p>
              <p className="text-xs text-zinc-500 font-bold">
                {isSubscribed ? (
                  <>
                    Hint: delete a previously uploaded file in the month of
                    <span className="font-bold">
                      {" "}
                      {format(new Date(), "MMM yyyy")}
                    </span>
                    .
                  </>
                ) : (
                  <>
                    <Link href="/pricing" className="text-blue-500 font-bold">
                      Upgrade to PRO
                    </Link>{" "}
                    to upload more files.
                  </>
                )}
              </p>
            </div>
          </div>
        ) : (
          <UploadDropzone isSubscribed={isSubscribed} />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UploadButton;
