
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { TRPCError,initTRPC } from '@trpc/server';
 
const t = initTRPC.create();
const middleware = t.middleware 

const isAuth = middleware(async (opts)=>{
    const {getUser} = getKindeServerSession()
    const user = getUser()

    if(!user || !user.id) throw new TRPCError({code: 'UNAUTHORIZED'})

    return opts.next({
        ctx: {
            userId: user.id,
            user
        }
    })
})

const isAdmin = middleware(async (opts)=> {
    const {getUser} = getKindeServerSession()
    const user = getUser()
    if(!user || !user.id) throw new TRPCError({code: 'UNAUTHORIZED'})
    if(user.id !== process.env.ADMIN_ID) throw new TRPCError({code: 'UNAUTHORIZED'})

    return opts.next({
        ctx: {
            userId: user.id,
            user

        }
    })
})
export const router = t.router;
export const publicProcedure = t.procedure;
export const privateProcedure = t.procedure.use(isAuth)
export const adminProcedure = t.procedure.use(isAdmin)