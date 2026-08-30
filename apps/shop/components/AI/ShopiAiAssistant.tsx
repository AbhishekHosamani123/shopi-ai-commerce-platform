"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import { useApp } from '@/Helpers/AccountDialog';
import { useMenu } from '@/Helpers/MenuContext';
import { setCart, addItemToCart } from '@/features/UIUpdates/CartWishlist';
import { cartAddHandler } from '@/app/api/itemLists';
import {
  sendAiShoppingMessage,
  AiProductCardData,
  RealCartStateData,
  CheckoutActionData,
  UserAddressData,
  ShopiAIContext
} from '@/app/api/aiShopping';
import SafeMarkdownRenderer from './SafeMarkdownRenderer';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'shopi';
  text: string;
  intent?: string;
  products?: AiProductCardData[];
  cart?: RealCartStateData;
  checkout?: CheckoutActionData;
  addresses?: UserAddressData[];
  selectedAddress?: UserAddressData;
  timestamp: string;
  isError?: boolean;
}

export default function ShopiAiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string>('');
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const [addedProductIds, setAddedProductIds] = useState<Set<string>>(new Set());
  const [hasGreeted, setHasGreeted] = useState(false);
  const [isCartProcessing, setIsCartProcessing] = useState(false);

  const router = useRouter();
  const pathname = usePathname() || '/';
  const dispatch = useAppDispatch();
  const { appState } = useApp();
  const { toggleCart } = useMenu();
  const isLogged = appState.loggedIn;
  const defaultAccount = useAppSelector((state) => state.userState.defaultAccount);
  const cartList = useAppSelector((state) => state.cartWishlist.cart);
  const activeProductContext = useAppSelector((state) => state.cartWishlist.activeProductContext);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Derive current page context
  const isProductPage = pathname.startsWith('/product/');
  const currentSku = isProductPage ? decodeURIComponent(pathname.replace('/product/', '').trim()) : undefined;

  const isSubCategoryPage = pathname.startsWith('/sub-category/');
  const subCatSegments = isSubCategoryPage ? pathname.split('/').filter(Boolean) : [];
  const currentGender = subCatSegments[1] || undefined;
  const currentCategory = subCatSegments[2] || undefined;

  const pageContext: ShopiAIContext = {
    pageType: isProductPage ? 'product' : isSubCategoryPage ? 'subcategory' : pathname.startsWith('/cart') ? 'cart' : 'home',
    currentProduct: currentSku
      ? {
          sku: currentSku,
          title: activeProductContext?.title || currentSku,
          price: activeProductContext?.price,
          mrp: activeProductContext?.mrp,
          category: activeProductContext?.category,
          selectedColor: activeProductContext?.selectedColor,
          selectedSize: activeProductContext?.selectedSize,
          selectedVariantImage: activeProductContext?.selectedVariantImage,
        }
      : undefined,
    selectedVariant: activeProductContext?.selectedColor || activeProductContext?.selectedSize
      ? {
          color: activeProductContext.selectedColor,
          size: activeProductContext.selectedSize,
          imageUrl: activeProductContext.selectedVariantImage,
        }
      : undefined,
    activeFilters: {
      category: currentCategory,
      gender: currentGender
    },
    cart: cartList.map((i) => ({
      productId: String(i.productID),
      name: i.productName,
      price: i.productPrice,
      quantity: i.quantity,
      color: i.productColor,
      size: i.productSize
    }))
  };

  // Dynamic quick action suggestions based on current browsing state
  const quickActions = isProductPage
    ? [
        { label: '✨ Tell me about this', prompt: 'Tell me about this product.' },
        { label: '💡 Why should I buy this?', prompt: 'Why should I buy this?' },
        { label: '⭐ How are reviews?', prompt: 'How are the reviews for this product?' },
        { label: '🎨 Available in black?', prompt: 'Is this available in black?' },
        { label: '📉 Similar but cheaper', prompt: 'Something like this but cheaper.' },
        { label: '🛍️ Add to cart', prompt: 'Add this to cart.' }
      ]
    : isSubCategoryPage
    ? [
        { label: '💰 Under ₹600', prompt: 'Show me something under ₹600.' },
        { label: '🚫 No black', prompt: "I don't want black." },
        { label: '👔 Best for office', prompt: 'Show me the best options for office wear.' },
        { label: '⭐ Top customer ratings', prompt: 'Show me the highest rated products.' },
        { label: '🛒 What is in my cart?', prompt: "What's in my cart?" }
      ]
    : [
        { label: '👔 Men\'s shirts under ₹600', prompt: 'Find me men\'s shirts under ₹600' },
        { label: '👟 Running shoes', prompt: 'Show me running shoes under ₹3000' },
        { label: '👗 Women\'s dresses', prompt: 'Show me popular women\'s dresses' },
        { label: '🛒 What\'s in my cart?', prompt: "What's in my cart?" },
        { label: '⚡ Best value deals', prompt: 'Show me the highest rated products with big discounts' }
      ];

  // Initialize unique conversation ID on mount
  useEffect(() => {
    setConversationId(`conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  }, []);

  // Show contextual welcome message when assistant opens for the first time
  useEffect(() => {
    if (isOpen && !hasGreeted && messages.length === 0) {
      const welcomeText = isProductPage
        ? `Hi! 👋 I'm **Shopi**, your AI shopping salesperson.\n\nI see you're viewing **${currentSku}**. I can give you product details, verify review sentiments, check variant stock, compare alternatives, or add it directly to your cart.`
        : isSubCategoryPage
        ? `Hi! 👋 I'm **Shopi**, your AI shopping salesperson.\n\nI can help you filter through **${currentGender || ''} ${currentCategory || 'catalog'}**, apply price constraints (e.g. *under ₹600*), exclude unwanted styles/colors, or recommend top-rated picks.`
        : `Hi! 👋 I'm **Shopi**, your AI shopping salesperson.\n\nTell me what you're looking for and I'll find products with verified reviews, explain trade-offs, and manage your cart.`;

      setMessages([
        {
          id: 'welcome_msg',
          sender: 'shopi',
          text: welcomeText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setHasGreeted(true);
    }
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
  }, [isOpen, hasGreeted, messages.length, isProductPage, isSubCategoryPage, currentSku, currentGender, currentCategory]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  // Synchronize Redux cart with real AI backend cart state
  const syncReduxCart = (backendCart?: RealCartStateData) => {
    if (!backendCart || !Array.isArray(backendCart.items)) return;

    const reduxCartItems = backendCart.items.map((item) => ({
      cartItemID: item.cartItemId,
      productID: item.productId,
      productImg: item.imageUrl || '',
      productAlt: item.name,
      productName: item.name,
      productPrice: item.price,
      productColor: item.color || 'Standard',
      productSize: item.size || 'Standard',
      quantity: item.quantity,
    }));

    dispatch(setCart(reduxCartItems));
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || input).trim();
    if (!textToSend || isLoading) return;

    const userMessageId = `user_${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMessageId,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInput('');
    setIsLoading(true);

    try {
      const activeUserId = isLogged && defaultAccount.userID ? defaultAccount.userID : undefined;
      const res = await sendAiShoppingMessage({
        message: textToSend,
        userId: activeUserId,
        conversationId,
        context: pageContext
      });

      if (res.status === 200 && res.data.success) {
        const aiMsg: ChatMessage = {
          id: `shopi_${Date.now()}`,
          sender: 'shopi',
          text: res.data.message || "Here is what I found for you:",
          intent: res.data.intent,
          products: res.data.products,
          cart: res.data.cart,
          checkout: res.data.checkout,
          addresses: res.data.addresses,
          selectedAddress: res.data.selectedAddress,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages((prev) => [...prev, aiMsg]);

        // If AI performed cart actions or returned cart, sync real Redux state!
        if (res.data.cart) {
          syncReduxCart(res.data.cart);
        }

        // If intent is view_product, navigate directly to canonical product detail page
        if (res.data.intent === 'view_product' && res.data.products && res.data.products.length > 0) {
          const target = res.data.products[0];
          const targetSkuOrId = String(target.sku || target.productId || target.id || '');
          if (targetSkuOrId) {
            router.push(`/product/${targetSkuOrId}`);
          }
        }
      } else {
        // Backend responded with success:false — show its honest guidance message
        // (e.g. add_to_cart_failed with instructions) rather than a generic error.
        const errorText = res.data?.message || res.data?.error || "Sorry, I couldn't complete that action. Please try again.";
        const isGuidance = Boolean(res.data?.message) && (res.data.intent || '').endsWith('_failed');
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            sender: 'shopi',
            text: errorText,
            cart: res.data?.cart,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isError: !isGuidance,
          },
        ]);
        if (res.data?.cart) {
          syncReduxCart(res.data.cart);
        }
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'shopi',
          text: "Network error: Unable to connect to the shopping assistant. Please check your connection and try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualAddToCart = async (product: AiProductCardData) => {
    const rawId = String(product.productId || product.id || product.sku || '');
    const prodIdNum = parseInt(rawId, 10) || 1;
    const prodTitle = product.title || product.name || 'Product';
    setAddingProductId(rawId);

    try {
      const activeUserId = isLogged && defaultAccount.userID ? defaultAccount.userID : 666574596;
      const randomCartItemId = Math.floor(Math.random() * 1000000);
      const activeColor = product.color || activeProductContext?.selectedColor || 'Standard';
      const activeSize = product.size || activeProductContext?.selectedSize || 'Standard';

      // Call backend insertion if logged in
      if (isLogged) {
        await cartAddHandler({
          cartItemID: randomCartItemId,
          userID: activeUserId,
          productID: prodIdNum,
          productPrice: product.price,
          colorID: 1,
          sizeID: 1,
          quantity: 1,
        });
      }

      // Dispatch to real storefront Redux state
      dispatch(
        addItemToCart({
          cartItemID: randomCartItemId,
          productID: product.sku || rawId,
          productImg: product.imageUrl,
          productAlt: prodTitle,
          productName: prodTitle,
          productPrice: product.price,
          productColor: activeColor,
          productSize: activeSize,
          quantity: 1,
        })
      );

      // Mark as added for visual checkmark
      setAddedProductIds((prev) => new Set(prev).add(rawId));

      // Append confirmation message to chat
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `add_confirm_${Date.now()}`,
            sender: 'shopi',
            text: `Added "**${prodTitle}**" (₹${product.price.toLocaleString('en-IN')}) to your cart! 🛒`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }, 300);
    } catch (err) {
      console.error('Error adding product from chat card:', err);
    } finally {
      setAddingProductId(null);
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        sender: 'shopi',
        text: "Hi! 👋 I'm **Shopi**, your AI shopping salesperson. Tell me what you're looking for and I'll find products, explain honest trade-offs, and manage your cart.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setConversationId(`conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  };

  return (
    <>
      {/* 1. FLOATING LAUNCHER BUTTON (Bottom-Right) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2.5 px-4 py-2.5 bg-gradient-to-r from-[#012652] to-[#0D94FB] hover:from-[#011d3f] hover:to-[#0B80D8] text-white font-semibold text-sm rounded-full shadow-xl shadow-[#0D94FB]/25 active:scale-95 transition-all duration-200 cursor-pointer border border-cyan-300/30 group select-none"
          aria-label="Ask Shopi AI Salesperson"
        >
          <span className="text-base animate-pulse">✨</span>
          <span className="tracking-tight font-bold">Ask Shopi</span>
          {isProductPage && currentSku && (
            <span className="text-[10px] bg-white/20 text-cyan-100 px-2 py-0.5 rounded-full font-mono">
              {currentSku}
            </span>
          )}
        </button>
      )}

      {/* 2. MODERN SHOPI SHOPPING ASSISTANT PANEL */}
      {isOpen && (
        <div
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[95vw] sm:w-[460px] h-[88vh] sm:h-[660px] max-h-[760px] bg-slate-900/95 backdrop-blur-2xl border border-slate-700/60 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-300"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shopi-assistant-title"
        >
          {/* HEADER */}
          <div className="bg-gradient-to-r from-[#012652] via-slate-850 to-[#011d3f] border-b border-slate-700/60 p-4 select-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#012652] to-[#0D94FB] p-0.5 shadow-md shadow-[#0D94FB]/20">
                  <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center text-lg">
                    ✨
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 id="shopi-assistant-title" className="font-bold text-white text-base tracking-tight flex items-center gap-1.5">
                      <span>Shopi</span>
                    </h3>
                    <span className="text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 bg-gradient-to-r from-[#0D94FB]/30 to-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-full">
                      AI Salesperson
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate max-w-[220px]">
                    Catalog & Review Intelligence
                  </p>
                </div>
              </div>

              {/* HEADER CONTROLS */}
              <div className="flex items-center gap-1">
                <button
                  onClick={handleResetChat}
                  title="Reset conversation"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  aria-label="Reset conversation"
                >
                  <i className="fa-solid fa-rotate-left text-xs"></i>
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  title="Close assistant"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  aria-label="Close assistant"
                >
                  <i className="fa-solid fa-xmark text-sm"></i>
                </button>
              </div>
            </div>

            {/* CURRENT BROWSING CONTEXT BADGE */}
            {isProductPage && currentSku && (
              <div className="mt-2.5 flex items-center gap-2 px-3 py-1.5 bg-cyan-950/70 border border-cyan-700/50 rounded-xl text-cyan-200 text-xs">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0"></span>
                <span className="text-slate-400">Viewing Product:</span>
                <span className="font-mono font-bold text-cyan-300 truncate">{currentSku}</span>
              </div>
            )}

            {isSubCategoryPage && (currentGender || currentCategory) && (
              <div className="mt-2.5 flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 border border-slate-700/60 rounded-xl text-slate-300 text-xs">
                <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0"></span>
                <span className="text-slate-400">Browsing:</span>
                <span className="font-semibold text-white capitalize">
                  {currentGender} &gt; {currentCategory}
                </span>
              </div>
            )}
          </div>

          {/* CONVERSATION MESSAGES AREA */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {messages.map((msg, mIdx) => (
              <div
                key={msg.id || `msg_${mIdx}`}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                {/* Message Bubble */}
                <div
                  className={`max-w-[90%] rounded-2xl px-4 py-3 shadow-md whitespace-pre-wrap leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-[#012652] to-[#0D94FB] text-white rounded-br-xs'
                      : msg.isError
                      ? 'bg-red-950/80 border border-red-800/60 text-red-200 rounded-bl-xs'
                      : 'bg-slate-800/90 border border-slate-700/70 text-slate-100 rounded-bl-xs'
                  }`}
                >
                  {msg.sender === 'shopi' && (
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-400 mb-1">
                      <span>✨</span>
                      <span>Shopi Salesperson</span>
                    </div>
                  )}
                  <SafeMarkdownRenderer content={msg.text} variant="dark" className={msg.sender === 'user' ? 'text-white' : 'text-slate-100'} />

                </div>

                {/* Timestamp */}
                <span className="text-[10px] text-slate-500 mt-1 px-1">{msg.timestamp}</span>

                {/* EMBEDDED PRODUCT CARDS */}
                {msg.products && msg.products.length > 0 && (
                  <div className="mt-3 w-full space-y-2.5">
                    <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider px-1 flex items-center justify-between">
                      <span>Products ({msg.products.length})</span>
                      <span className="text-[10px] text-slate-400 lowercase font-normal">verified in Supabase catalog</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2.5">
                      {msg.products.map((product, pIdx) => {
                        const prodSku = product.sku || String(product.productId || product.id || `prod_${pIdx}`);
                        const prodId = String(product.productId || product.id || prodSku);
                        const prodTitle = product.title || product.name || 'Product';
                        const isAdding = addingProductId === prodId || addingProductId === prodSku;
                        const isAdded = addedProductIds.has(prodId) || addedProductIds.has(prodSku);
                        const rating = product.stars || product.rating || 4.2;
                        const reviewCount = product.reviewCount || 12;

                        return (
                          <div
                            key={`prod_${msg.id}_${prodSku}_${pIdx}`}
                            className="bg-slate-800/90 border border-slate-700/80 hover:border-cyan-500/50 rounded-2xl p-3.5 flex gap-3.5 shadow-lg hover:shadow-xl transition-all group"
                          >
                            {/* Product Thumbnail */}
                            <div className="w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-slate-950 border border-slate-700/50 relative">
                              <img
                                src={product.imageUrl}
                                alt={prodTitle}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src =
                                    'https://ogppkxqvfzsusdawqbzx.supabase.co/storage/v1/object/public/shopi-product-images/placeholder.jpg';
                                }}
                              />
                              {product.discountPercentage && product.discountPercentage > 0 && (
                                <span className="absolute top-1 left-1 bg-rose-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-md shadow">
                                  {product.discountPercentage}% OFF
                                </span>
                              )}
                            </div>

                            {/* Product Details & Actions */}
                            <div className="flex-1 flex flex-col justify-between min-w-0">
                              <div>
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wide truncate">
                                    {product.category || 'Apparel'}
                                  </span>
                                  {product.sku && (
                                    <span className="text-[9px] font-mono bg-slate-900/80 text-slate-400 px-1.5 py-0.5 rounded">
                                      {product.sku}
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-xs font-bold text-white line-clamp-2 mt-0.5 group-hover:text-cyan-300 transition-colors">
                                  {prodTitle}
                                </h4>

                                {/* Rating Badge */}
                                <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-400">
                                  <span>⭐</span>
                                  <span className="font-bold">{rating.toFixed(1)}</span>
                                  <span className="text-slate-400 text-[10px]">({reviewCount})</span>
                                </div>

                                {/* Price & MRP */}
                                <div className="mt-1 flex flex-col">
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-sm font-extrabold text-emerald-400">
                                      ₹{product.price.toLocaleString('en-IN')}
                                    </span>
                                    {product.mrp && product.mrp > product.price && (
                                      <span className="text-[10px] text-slate-500 line-through">
                                        ₹{product.mrp.toLocaleString('en-IN')}
                                      </span>
                                    )}
                                  </div>

                                  {/* Variant Badges (Color / Size) */}
                                  {(product.color || product.size) && (
                                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                      {product.color && (
                                        <span className="text-[10px] font-semibold bg-cyan-950/80 border border-cyan-700/50 text-cyan-300 px-1.5 py-0.5 rounded">
                                          Color: {product.color}
                                        </span>
                                      )}
                                      {product.size && (
                                        <span className="text-[10px] font-semibold bg-slate-800 border border-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                                          Size: {product.size}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Card Action Buttons */}
                              <div className="mt-2.5 flex items-center gap-1.5">
                                <button
                                  onClick={() => handleManualAddToCart(product)}
                                  disabled={isAdding}
                                  className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                    isAdded
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-gradient-to-r from-[#012652] to-[#0D94FB] hover:from-[#011d3f] hover:to-[#0B80D8] text-white shadow-sm'
                                  }`}
                                >
                                  {isAdding ? (
                                    <span className="animate-spin text-[10px]">⏳</span>
                                  ) : isAdded ? (
                                    <>
                                      <span>✓</span>
                                      <span>Added</span>
                                    </>
                                  ) : (
                                    <>
                                      <span>+</span>
                                      <span>Add to Cart</span>
                                    </>
                                  )}
                                </button>
                                <Link
                                  href={`/product/${product.sku || prodId}`}
                                  className="py-1.5 px-2.5 bg-slate-700/80 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 shrink-0"
                                >
                                  <span>View</span>
                                  <span className="text-[10px]">→</span>
                                </Link>
                                <button
                                  onClick={() => handleSendMessage(`Tell me about ${product.sku || prodTitle}`)}
                                  title="Ask Shopi about this product"
                                  className="py-1.5 px-2 bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-700/40 text-cyan-300 text-xs rounded-lg transition-colors cursor-pointer"
                                >
                                  ✨ Ask
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* CHECKOUT ACTION BUTTON */}
                {msg.sender === 'shopi' && msg.checkout?.available && !msg.checkout.isCartEmpty && (
                  <div className="mt-3 w-full">
                    <button
                      onClick={() => {
                        if (isCartProcessing) return;
                        setIsCartProcessing(true);
                        // Full page load (not router.push) so the checkout page mounts
                        // fresh and fetches the cart AFTER the AI's server-side add commits.
                        window.location.href = msg.checkout!.url || '/cart-checkout';
                      }}
                      disabled={isCartProcessing}
                      className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-900/40 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60"
                    >
                      <span>🛒</span>
                      <span>{isCartProcessing ? 'Opening secure checkout…' : 'Proceed to Checkout'}</span>
                      <span className="text-xs">→</span>
                    </button>
                    {typeof msg.checkout.total === 'number' && msg.checkout.total > 0 && (
                      <p className="text-[10px] text-slate-400 text-center mt-1.5">
                        Cart total: <span className="text-emerald-400 font-bold">₹{msg.checkout.total.toLocaleString('en-IN')}</span> · Secure Razorpay checkout
                      </p>
                    )}
                  </div>
                )}

                {/* SAVED ADDRESSES (for address_update intent) */}
                {msg.sender === 'shopi' && msg.addresses && msg.addresses.length > 0 && (
                  <div className="mt-3 w-full space-y-2">
                    <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider px-1">
                      Saved Addresses
                    </div>
                    {msg.addresses.map((addr) => (
                      <div
                        key={addr.addressID}
                        className={`p-3 rounded-xl border text-xs transition-all ${
                          msg.selectedAddress?.addressID === addr.addressID
                            ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-100'
                            : 'bg-slate-800/90 border-slate-700/70 text-slate-200 hover:border-cyan-600/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-white">{addr.userName}</span>
                          <span className="flex items-center gap-1.5">
                            {addr.is_default && (
                              <span className="text-[9px] bg-amber-900/60 text-amber-300 px-1.5 py-0.5 rounded font-semibold">DEFAULT</span>
                            )}
                            <span className="text-[9px] bg-slate-700/80 text-slate-300 px-1.5 py-0.5 rounded uppercase">{addr.addressType}</span>
                          </span>
                        </div>
                        <p className="mt-1 text-slate-300 leading-relaxed">
                          {addr.addressLine1}{addr.addressLine2 ? `, ${addr.addressLine2}` : ''}<br />
                          {addr.city}, {addr.state} — {addr.postalCode}
                        </p>
                      </div>
                    ))}
                    <button
                      onClick={() => router.push('/cart-checkout')}
                      className="w-full py-2.5 px-4 bg-slate-700/80 hover:bg-slate-600 text-slate-100 font-semibold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span>📍</span>
                      <span>Manage Address at Checkout</span>
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-center gap-2 text-cyan-400 bg-slate-800/60 border border-slate-700/50 rounded-2xl px-4 py-2.5 w-fit animate-pulse">
                <span className="text-sm animate-spin">✨</span>
                <span className="text-xs font-medium text-slate-300">Shopi is reasoning over catalog data...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* QUICK SUGGESTIONS CAROUSEL */}
          <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto scrollbar-none">
            {quickActions.map((action, idx) => (
              <button
                key={`qa_${idx}`}
                onClick={() => handleSendMessage(action.prompt)}
                disabled={isLoading}
                className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {action.label}
              </button>
            ))}
          </div>

          {/* INPUT FORM */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3.5 bg-slate-900 border-t border-slate-700/60 flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isProductPage ? `Ask about ${currentSku || 'this product'}...` : "Ask Shopi anything about products, fit, prices..."}
              disabled={isLoading}
              className="flex-1 bg-slate-800/90 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-400 outline-none transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-4 py-2.5 bg-gradient-to-r from-[#012652] to-[#0D94FB] hover:from-[#011d3f] hover:to-[#0B80D8] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
              aria-label="Send message"
            >
              <span>Send</span>
              <span className="text-xs">➤</span>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
