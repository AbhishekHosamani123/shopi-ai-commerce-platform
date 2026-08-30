"use client"
import { currentEvent, featuresSec, testimonial } from '@/app/data'
import React, { useState } from 'react'

const Details = () => {
    const [hover, sethover] = useState<number | null>(null);
  return (
    <div className='flex w-full flex-wrap justify-center mt-5 gap-8'>
        <div>
            <p className='tracking-base text-xl font-semibold text-slate-800 border-b-[1px] pb-3 border-b-slate-200'>Testimonial</p>
            <div className='rounded-xl w-80 h-[375px] border border-slate-200 mt-8 flex justify-center items-center flex-col gap-3 p-6 bg-white shadow-xs'>
                <img height={80} width={80} src={testimonial.imgLink} alt={testimonial.name} className='rounded-full object-cover shadow-sm'/>
                <p className='text-slate-900 font-bold text-base tracking-wide'>{testimonial.name}</p>
                <p className='text-slate-500 text-xs font-medium'>{testimonial.position}</p>
                <img width={26} src='https://codewithsadee.github.io/anon-ecommerce-website/assets/images/icons/quotes.svg' alt="quote icon"/>
                <p className='text-center text-slate-600 text-sm leading-relaxed px-2'>{testimonial.description}</p>
            </div>
        </div>
        <div className='w-[640px] h-[450px] relative rounded-xl overflow-hidden shadow-xs'>
            <img className='h-full w-full rounded-xl object-cover' src='https://codewithsadee.github.io/anon-ecommerce-website/assets/images/cta-banner.jpg' alt="Summer collection banner"/>
            <div className='w-[55%] h-[65%] left-0 right-0 top-0 bottom-0 m-auto absolute bg-white/85 backdrop-blur-xs rounded-xl flex flex-col items-center justify-center gap-2 p-6 shadow-lg'>
                {currentEvent.isDiscount && (
                    <span className='text-white bg-slate-900 px-3 py-1 rounded-md font-bold text-xs tracking-wider uppercase'>
                        {currentEvent.discount}% DISCOUNT
                    </span>
                )}
                <p className='text-2xl sm:text-3xl font-extrabold text-slate-900 text-center leading-tight'>
                    {currentEvent.titleFirst} {currentEvent.titleLast}
                </p>
                <p className='text-sm text-slate-600 font-medium'>
                    Starting @ <span className="font-bold text-slate-900">₹{currentEvent.starting || 399}</span>
                </p>
                <a href={currentEvent.eventLink || '/categories/Clothing'}>
                    <button className='bg-[#0D94FB] hover:bg-[#012652] text-white px-6 py-2 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-[#0D94FB]/20 mt-1 cursor-pointer'>
                        Shop Now
                    </button>
                </a>
            </div>
        </div>
        <div>
            <p className='tracking-base text-xl font-semibold text-slate-800 border-b-[1px] pb-3 border-b-slate-200'>Our Services</p>
            <div className='rounded-xl w-80 h-[375px] border border-slate-200 p-6 mt-8 flex justify-center flex-col gap-5 bg-white shadow-xs'>
                {featuresSec.map((each,index)=>
                    <a key={index} href='/our-services' onMouseEnter={()=>sethover(index)} onMouseLeave={()=>sethover(null)} className='flex justify-start items-center gap-4 group'>
                    <div className='w-[40px] h-[40px] flex items-center justify-center rounded-lg bg-slate-50 text-[#0D94FB] group-hover:bg-[#0D94FB] group-hover:text-white transition-colors'><i className={`${each.icon} text-lg`}></i></div>
                    <div>
                        <p className='font-semibold text-sm tracking-tight text-slate-800 group-hover:text-[#0D94FB] transition-colors'>{each.title}</p>
                        <p className='text-xs text-slate-500'>{each.description}</p>
                    </div>
                    </a>
                )}
            </div>
        </div>
    </div>
  )
}

export default Details