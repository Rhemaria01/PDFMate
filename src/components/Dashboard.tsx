'use client'
import React,{useState} from 'react'
import UploadButton from './UploadButton'
import { trpc } from '@/app/_trpc/client'
import { Ghost, Loader2, Trash } from 'lucide-react'
import Skeleton from 'react-loading-skeleton'

import { Button } from './ui/button'
import { getUserSubscriptionPlan } from '@/lib/stripe'

import { useToast } from './ui/use-toast'
import { Input } from './ui/input'
import DashboardCard from './DashboardCard'

interface PagePros {
    subscriptionPlan: Awaited<ReturnType<typeof getUserSubscriptionPlan>>,
    isAdmin: boolean 
}
const Dashboard = ({subscriptionPlan, isAdmin}: PagePros) => {
    
    const {data: files, isLoading} = trpc.getUserFiles.useQuery()
   
    
    
    const [fileId,setfileId] = useState<string>('')
    
    const {toast} = useToast()

    const {mutate: deleteFileFromEverywhere, isLoading: deleting} = trpc.deleteFileFromEverywhere.useMutation({
        
        onSuccess: ({title, description}) => {
            toast({
                title,
                description, 
                variant: 'destructive'
            })
            setfileId('')
        }
    })

    
    
    
  return (
    <main className='mx-auto max-w-7xl md:p-10'>
        <div className='mt-8 flex flex-col items-start justify-between gap-y border-b border-gray-200 pb-5 sm:flex-row sm:items-center sm:gap-0'>
            <h1 className='mb-3 font-bold text-5xl text-gray-900 '>
                My Files
            </h1>
            {
                isLoading  ?
                <Button disabled={true}>
                    <Loader2 className='h-4 w-4 animate-spin' />
                </Button>
                :  <UploadButton isAdmin={isAdmin} isSubscribed={subscriptionPlan.isSubscribed} />

            }
            
        </div>

        {/* Display all user files */}
        {isAdmin ? (
            <div className='flex flex-col my-8 w-full px-5 py-2 bg-white rounded-lg gap-y-5'>
                <h3 className='text-3xl font-semibold'>
                    Admin Controls
                </h3>
                <div className='flex gap-x-5 items-center'>
                <h4 className='text-lg'>Delete File from DB, Pinecone and Uploadthing:</h4> 
                <Input 
                value={fileId}
                disabled={deleting}
                onChange={(e)=>setfileId(e.target.value)}
                onKeyDown={(e)=>{
                    if(e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        deleteFileFromEverywhere({fileId})
                    }     
                }}
                placeholder='Enter FileId'
                className='w-1/2'
                />
                <Button
                disabled={deleting}
                onClick={()=>deleteFileFromEverywhere({fileId})}
                size='sm'
                variant='destructive'
                >
                   {deleting ? <Loader2 className='h-4 w-4 animate-spin' /> :<Trash className='h-4 w-4'/>}
                </Button>
                </div>
            </div>
        ) : null}
        {files && files?.length !== 0 ? 
        (<ul className=' grid grid-cols-1 gap-6 divide-y divide-zinc-200 md:grid-cols-2 lg:grid-cols-3'>
                {files.sort((a,b) => 
                new Date(b.createdAt).getTime() -
                 new Date(a.createdAt).getTime()).map( (file) => {
                    return <DashboardCard file={file} key={file.id}/>
                    })}

                    
        </ul>
        ) : isLoading ? (<Skeleton height={100} className='my-2' count={3}/>) :  (<div className='mt-16 flex flex-col items-center gap-2'>
            <Ghost className='h-8 w-8 text-zinc-800' />
            <h3 className='font-semibold text-xl'>Pretty Empty around here</h3>
            <p>Let&apos;s upload your first pdf</p>
        </div>) }
        
    </main>
  )
}

export default Dashboard