import React, { useState, useEffect } from 'react';


interface PropType {
  endTime?: string;
}

const DealTime: React.FC<PropType> = ({ endTime }) => {
  const calculateTimeRemaining = (targetTime?: string) => {
    const now = new Date();
    let end = targetTime ? new Date(targetTime) : null;

    // If invalid date or in the past, fallback to end of current day (midnight)
    if (!end || isNaN(end.getTime()) || end.getTime() <= now.getTime()) {
      end = new Date();
      end.setHours(23, 59, 59, 999);
    }

    const timeDifference = end.getTime() - now.getTime();

    if (timeDifference <= 0) {
      return {
        days: '00',
        hours: '00',
        minutes: '00',
        seconds: '00'
      };
    }

    const seconds = Math.floor((timeDifference / 1000) % 60).toString().padStart(2, '0');
    const minutes = Math.floor((timeDifference / 1000 / 60) % 60).toString().padStart(2, '0');
    const hours = Math.floor((timeDifference / (1000 * 60 * 60)) % 24).toString().padStart(2, '0');
    const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24)).toString().padStart(2, '0');

    return {
      days,
      hours,
      minutes,
      seconds
    };
  };

  const [timeRemaining, setTimeRemaining] = useState({
    days: '00',
    hours: '00',
    minutes: '00',
    seconds: '00'
  });

  useEffect(() => {
    setTimeRemaining(calculateTimeRemaining(endTime));

    const timer = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining(endTime));
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime]);

  return (
    <div className='flex gap-3 sm:gap-4' role="timer" aria-label="Deal countdown timer">
      <div className='flex flex-col bg-slate-100 w-14 h-14 sm:w-16 sm:h-16 rounded-xl items-center justify-center border border-slate-200'>
        <p className='text-lg sm:text-xl font-bold text-slate-900'>{timeRemaining.days}</p>
        <p className='text-[10px] sm:text-xs font-semibold text-slate-500 uppercase'>Days</p>
      </div>
      <div className='flex flex-col bg-slate-100 w-14 h-14 sm:w-16 sm:h-16 rounded-xl items-center justify-center border border-slate-200'>
        <p className='text-lg sm:text-xl font-bold text-slate-900'>{timeRemaining.hours}</p>
        <p className='text-[10px] sm:text-xs font-semibold text-slate-500 uppercase'>Hours</p>
      </div>
      <div className='flex flex-col bg-slate-100 w-14 h-14 sm:w-16 sm:h-16 rounded-xl items-center justify-center border border-slate-200'>
        <p className='text-lg sm:text-xl font-bold text-slate-900'>{timeRemaining.minutes}</p>
        <p className='text-[10px] sm:text-xs font-semibold text-slate-500 uppercase'>Min</p>
      </div>
      <div className='flex flex-col bg-slate-100 w-14 h-14 sm:w-16 sm:h-16 rounded-xl items-center justify-center border border-slate-200'>
        <p className='text-lg sm:text-xl font-bold text-slate-900'>{timeRemaining.seconds}</p>
        <p className='text-[10px] sm:text-xs font-semibold text-slate-500 uppercase'>Sec</p>
      </div>
    </div>
  );
};

export default DealTime;
