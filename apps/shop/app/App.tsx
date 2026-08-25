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
    <main className="h-screen w-screen flex items-center flex-col overflow-x-hidden">
      <Cart />
      <Favourite />
      <Menubar />
      <Navbar />
      <Banner />
      <Trends />
      <Status />
      <Details />
      <Tabs />
      <Footer />
      <ShopiAiAssistant />
    </main>
  );
};

export default App;