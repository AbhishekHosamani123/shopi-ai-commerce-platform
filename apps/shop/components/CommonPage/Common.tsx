"use client";
import React from 'react';
import dynamic from 'next/dynamic';
import Footer from '@/components/Footer';
import Menubar from '@/components/Mobile-Interface/Menubar';
import Sidebar from '@/components/Mobile-Interface/Sidebar';
import Navbar from '@/components/Navbar';
import Cart from '../ProductUi/Cart';
import Favourite from '../ProductUi/Favourite';

// Dynamically load Shopi AI without blocking critical initial render
const ShopiAiAssistant = dynamic(() => import('../AI/ShopiAiAssistant'), {
  ssr: false,
});

interface ParentComponentProps {
  Component: React.ComponentType;
}

const Common: React.FC<ParentComponentProps> = ({ Component }) => {
  return (
    <div className="min-h-screen w-full flex flex-col items-center overflow-x-hidden">
      <Menubar />
      <Cart />
      <Favourite />
      <Sidebar />
      <Navbar />
      <main className="flex-1 w-full flex flex-col items-center">
        <Component />
      </main>
      <Footer />
      <ShopiAiAssistant />
    </div>
  );
};

export default Common;