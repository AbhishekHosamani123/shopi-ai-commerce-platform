"use client";
import React from 'react';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import Trends from '@/components/Trends';
import Status from '@/components/Status';
import Footer from '@/components/Footer';
import Details from '@/components/Details';
import Tabs from '@/components/Tabs';
import Menubar from '@/components/Mobile-Interface/Menubar';
import Cart from '@/components/ProductUi/Cart';
import Favourite from '@/components/ProductUi/Favourite';
import Banner from '@/components/Banner';

// Dynamically load Shopi AI assistant
const ShopiAiAssistant = dynamic(() => import('@/components/AI/ShopiAiAssistant'), {
  ssr: false,
});

const App = () => {
  return (
    <div className="min-h-screen w-full flex items-center flex-col overflow-x-hidden">
      <Cart />
      <Favourite />
      <Menubar />
      <Navbar />
      <main className="w-full flex-1 flex flex-col items-center">
        <Banner />
        <Trends />
        <Status />
        <Details />
        <Tabs />
      </main>
      <Footer />
      <ShopiAiAssistant />
    </div>
  );
};

export default App;