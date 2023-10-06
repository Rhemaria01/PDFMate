import { format } from 'date-fns'
import { Loader2, MessageSquare, Plus, Trash } from 'lucide-react'
import Link from 'next/link'
import React, { useState } from 'react'
import { Button } from './ui/button'
import { trpc } from '@/app/_trpc/client'
import { UploadStatus } from '@prisma/client'


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
    const [lastMessage,setLastMessage] = useState<string | null>(null)
    // const [deletingFile, setCurrentlyDeletingFile] = useState<string | null>(null)
    const utils = trpc.useContext()
    const { mutate: deleteFile, isLoading: deletingFile } = trpc.deleteFile.useMutation({
        onSuccess: () => {
            utils.getUserFiles.invalidate()
        }
    })
    const {isLoading,} = trpc.getFileMessages.useQuery({
        limit:1,
        fileId: file.id,
    },{
        onSuccess: ({messages}) => {

            if(messages.length > 0 ) setLastMessage( messages[0]?.text )
            else setLastMessage('')
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
                            <div className='flex items-center gap-2'>
                                <Plus className='h-4 w-4'/>
                                {format(new Date(file.createdAt),'MMM yyyy')}
                            </div>

                            <div className='flex items-center gap-2  '>
                                <MessageSquare className='h-4 w-4' />
                                {
                                    isLoading ? (<Loader2 className='h-4 w-4 animate-spin' />)
                                     : lastMessage ? (
                                     <p className='truncate w-24'>
                                        {lastMessage}
                                    </p>
                                    ):
                                     'No Messages'
                                }
                            </div>

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