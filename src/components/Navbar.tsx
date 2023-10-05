import React from 'react'
import MaxWidthWrapper from './MaxWidthWrapper'
import Link from "next/link"
import { buttonVariants } from './ui/button'
import {LoginLink, RegisterLink, getKindeServerSession} from "@kinde-oss/kinde-auth-nextjs/server"
import { ArrowRight } from 'lucide-react'
import UserAccountNav from './UserAccountNav'
import MobileNav from './MobileNav'
import Image from 'next/image'
const Navbar = () => {
    const {getUser} = getKindeServerSession()
    const user = getUser()
    const isAdmin = user?.id === process.env.ADMIN_ID ?? false
  return (
    <nav className='sticky h-14 inset-x-0 top-0 z-30 w-full border-b border-gray-200 bg-white/75 backdrop-blur-lg transition-all'>
        <MaxWidthWrapper>
            <div className='flex h-14 items-center justify-between border-b border-zinc-200'>
                <div className='flex items-center gap-x-5'>
                <Link href='https://code-rustlers.vercel.app/' target='_blank'>
                <Image src='/logo.webp' alt="Company logo" height={150} width={75}/>
                </Link>
                <Link href="/" className="flex z-40 font-semibold">
                   <span> PDFMate</span>
                </Link>
                </div>
                <MobileNav isAuth={!!user}/>
                <div className='hidden items-center space-x-4 sm:flex'>
                    {!user ?<>
                        <Link href="/pricing" className={buttonVariants({
                            variant: "ghost",
                            size: "sm"
                        })}>Pricing</Link>

                        <LoginLink className={buttonVariants({
                            variant: "ghost",
                            size: "sm"
                        })}>Sign in</LoginLink>

                        <RegisterLink className={buttonVariants({
                            size: "sm"
                        })}>
                            Get Started <ArrowRight className='ml-1.5 h-5 w-5'/>
                        </RegisterLink>
                    </> : <>
                        <Link href="/dashboard" className={buttonVariants({
                            variant: "ghost",
                            size: "sm"
                        })}>Dashboard
                        </Link>
                        <UserAccountNav isAdmin={isAdmin} email={user.email ?? ''} 
                        name={!user.given_name || 
                            !user.family_name ? 
                            "Your Account" : `${user.given_name} ${user.family_name}`}
                        imageUrl={user.picture ?? ''} />
                    </>}
                </div>
            </div>
        </MaxWidthWrapper>
    </nav>
  )
}

export default Navbar