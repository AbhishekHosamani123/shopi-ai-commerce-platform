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
    <div className="overflow-x-hidden w-screen h-screen flex flex-col items-center">
      <Menubar />
      <Cart />
      <Favourite />
      <Sidebar />
      <Navbar />
      <Component />
      <Footer />
      <ShopiAiAssistant />
    </div>
  );
};

export default Common;