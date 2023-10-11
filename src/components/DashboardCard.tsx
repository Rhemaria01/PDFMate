import { format } from 'date-fns'
import { Loader2, MessageSquare, Plus, Trash, XCircle } from 'lucide-react'
import Link from 'next/link'
import React, { useState } from 'react'
import { Button } from './ui/button'
import { trpc } from '@/app/_trpc/client'
import { UploadStatus } from '@prisma/client'
import { TooltipProvider, TooltipTrigger, Tooltip, TooltipContent } from "@/components/ui/tooltip"


interface DashboardCardProps{

    file:{
        userId: string | null;
        key: string;
        id: string;
        url: string;
        createdAt: string;
        updatedAt: string;
        name: string;
        uploadStatus: UploadStatus;
    }

}

const DashboardCard = ({file}: DashboardCardProps) => {
    const [messageCount,setMessageCount] = useState<number>(0)
    // const [deletingFile, setCurrentlyDeletingFile] = useState<string | null>(null)
    const utils = trpc.useContext()
    const { mutate: deleteFile, isLoading: deletingFile } = trpc.deleteFile.useMutation({
        onSuccess: () => {
            utils.getUserFiles.invalidate()
        }
    })
    const {isLoading} = trpc.getMessageCount.useQuery({
        fileId: file.id,
    },{
        onSuccess: (message) => {

            setMessageCount(message!) 
        }
    })

  return (
    <li key={file.id} 
                    className='col-span-1 divide-y divide-gray-200 rounded-lg bg-white shadow transition hover:shadow-lg'>
                        <Link href={`/dashboard/${file.id}`}
                         className='flex flex-col gap-2'>
                            <div className='pt-6 px-6 w-full flex items-center justify-between space-x-6'>
                                <div className='h-10 w-10 flex-shrink-0 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500' />
                                <div className='flex-1 truncate'>
                                    <div className='flex items-center space-x-3'>
                                        <h3 className='truncatre text-lg font-medium text-zinc-900'>{file.name}</h3>
                                    </div>
                                </div>
                            </div>
                         </Link>
                         <div className='px-6 mt-4 grid grid-cols-3 place-items-center py-2 gap-6 text-xs text-zinc-500'>
                            <TooltipProvider>
                            <Tooltip delayDuration={300}>
                                <TooltipTrigger className='cursor-default flex items-center gap-2'>
                                    <Plus className='h-4 w-4'/>
                                    {format(new Date(file.createdAt),'MMM yyyy')}
                                </TooltipTrigger>
                                <TooltipContent className='text-sm text-black flex flex-col'>
                                    <span className='text-xs text-zinc-500'>uploaded on:</span>
                                     {format(new Date(file.createdAt),'E do MMMM yyyy HH:mm')}
                                </TooltipContent>
                            </Tooltip>
                            <div className='flex items-center'>
                            {file.uploadStatus === "FAILED" ? (
                            <Tooltip  delayDuration={300}>
                                <TooltipTrigger className='cursor-default flex items-center'>
                                    <XCircle className='h-4 w-4 text-red-500 mr-1' /> 
                                    <p className='text-red-500 font-semibold'>Failed</p>
                                </TooltipTrigger>
                                <TooltipContent  className="bg-destructive text-destructive-foreground text-xs w-72 p-2 flex flex-col">
                                This document surpasses the page limit defined by your subscription plan or due to an alternate cause you can&apos;t converse with it.
                                <span className='font-semibold mt-1 italic'>  Deleting this file is advisable as it impacts your allocated file count. </span>
                                </TooltipContent>
                            </Tooltip> 
                            ) :
                            <>
                            <MessageSquare className='h-4 w-4 mr-2 mt-1' />
                                
                            {
                                file.uploadStatus === "SUCCESS" ? isLoading ? (<Loader2 className='h-4 w-4 animate-spin' />)
                                : messageCount ? `${messageCount} messages`  : 'No messages' 
                                : null
                            }
                            
                            {
                                file.uploadStatus === "PROCESSING" ? "File in Process" : null
                            }
                            </>}
                                

                                
                            </div>
                            </TooltipProvider>
                            <Button
                            onClick={()=>deleteFile({id: file.id})}
                            size='sm'
                            variant='destructive'
                            className='w-full'>
                               {deletingFile  ? (<Loader2 className='h-4 w-4 animate-spin' />) : <Trash className='h-4 w-4'/>}
                            </Button>
                         </div>


                    </li>
  )
}

export default DashboardCard