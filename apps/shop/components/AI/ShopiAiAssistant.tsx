"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import { useApp } from '@/Helpers/AccountDialog';
import { useMenu } from '@/Helpers/MenuContext';
import { setCart, addItemToCart } from '@/features/UIUpdates/CartWishlist';
import { cartAddHandler } from '@/app/api/itemLists';
import { sendAiShoppingMessage, AiProductCardData, RealCartStateData, CheckoutActionData, UserAddressData } from '@/app/api/aiShopping';
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

const QUICK_ACTIONS = [
  { label: '🧥 Find a jacket', prompt: 'Find me a jacket under ₹3000' },
  { label: '👟 Running shoes', prompt: 'Show me running shoes under ₹3000' },
  { label: '💰 Under ₹1000', prompt: 'Find me something under ₹1000' },
  { label: '👗 Women\'s tops', prompt: 'Find women\'s tops' },
  { label: '🛒 What\'s in my cart?', prompt: 'What\'s in my cart?' },
  { label: '⚡ Best deals', prompt: 'Show me the best deals on trending products' },
];

export default function ShopiAiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string>('');
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const [addedProductIds, setAddedProductIds] = useState<Set<string>>(new Set());
  const [hasGreeted, setHasGreeted] = useState(false);

  const router = useRouter();
  const dispatch = useAppDispatch();
  const { appState } = useApp();
  const { toggleCart } = useMenu();
  const isLogged = appState.loggedIn;
  const defaultAccount = useAppSelector((state) => state.userState.defaultAccount);
  const cartList = useAppSelector((state) => state.cartWishlist.cart);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize unique conversation ID on mount
  useEffect(() => {
    setConversationId(`conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  }, []);

  // Show official welcome message when assistant opens for the first time
  useEffect(() => {
    if (isOpen && !hasGreeted && messages.length === 0) {
      setMessages([
        {
          id: 'welcome_msg',
          sender: 'shopi',
          text: "Hi! 👋 I'm Shopi, your AI shopping assistant.\n\nTell me what you're looking for and I'll help you find products, compare prices, and manage your shopping cart.",
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
  }, [isOpen, hasGreeted, messages.length]);

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
      productID: parseInt(item.productId, 10),
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
          const targetProdId = String(target.productId || target.id || '');
          if (targetProdId) {
            router.push(`/product/${targetProdId}`);
          }
        }
      } else {
        const errorText = res.data?.error || "Sorry, I couldn't complete that action. Please try again.";
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            sender: 'shopi',
            text: errorText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isError: true,
          },
        ]);
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
    const rawId = String(product.productId || product.id || '');
    const prodIdNum = parseInt(rawId, 10);
    const prodTitle = product.title || product.name || 'Product';
    setAddingProductId(rawId);

    try {
      const activeUserId = isLogged && defaultAccount.userID ? defaultAccount.userID : 666574596;
      const randomCartItemId = Math.floor(Math.random() * 1000000);

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
          productID: prodIdNum,
          productImg: product.imageUrl,
          productAlt: prodTitle,
          productName: prodTitle,
          productPrice: product.price,
          productColor: 'Standard',
          productSize: 'Standard',
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
        text: "Hi! 👋 I'm Shopi, your AI shopping assistant. Tell me what you're looking for and I'll help you find products, compare prices, and manage your shopping cart.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setConversationId(`conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  };

  return (
    <>
      {/* 1. COMPACT FLOATING LAUNCHER BUTTON (Bottom-Right) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-2.5 bg-[#0D94FB] hover:bg-[#012652] text-white font-semibold text-sm rounded-full shadow-lg shadow-[#0D94FB]/30 hover:shadow-xl active:scale-95 transition-all duration-200 cursor-pointer border border-white/20 group select-none"
          aria-label="Ask Shopi"
        >
          <span className="text-base">✨</span>
          <span className="tracking-tight">Ask Shopi</span>
        </button>
      )}

      {/* 2. MODERN SHOPI SHOPPING ASSISTANT PANEL */}
      {isOpen && (
        <div
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[94vw] sm:w-[440px] h-[86vh] sm:h-[640px] max-h-[740px] bg-slate-900/95 backdrop-blur-2xl border border-slate-700/60 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-300"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shopi-assistant-title"
        >
          {/* HEADER */}
          <div className="bg-gradient-to-r from-[#012652] via-slate-850 to-[#011d3f] border-b border-slate-700/60 p-4 flex items-center justify-between select-none">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#012652] to-[#0D94FB] p-0.5 shadow-md shadow-[#0D94FB]/20">
                <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center text-lg">
                  ✨
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 id="shopi-assistant-title" className="font-bold text-white text-base tracking-tight flex items-center gap-1.5">
                    <span>✨</span>
                    <span>Shopi</span>
                  </h3>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-[#0D94FB]/20 text-[#0D94FB] border border-[#0D94FB]/30 rounded-full">
                    Assistant
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate max-w-[220px]">
                  Personal Shopping Assistant
                </p>
              </div>
            </div>

            {/* HEADER CONTROLS */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleResetChat}
                title="Reset conversation"
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Reset conversation"
              >
                <i className="fa-solid fa-rotate-left text-xs"></i>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close assistant"
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Close assistant"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>
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
                  className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-md whitespace-pre-wrap leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-[#012652] to-[#0D94FB] text-white rounded-br-xs'
                      : msg.isError
                      ? 'bg-red-950/80 border border-red-800/60 text-red-200 rounded-bl-xs'
                      : 'bg-slate-800/90 border border-slate-700/70 text-slate-100 rounded-bl-xs'
                  }`}
                >
                  {msg.sender === 'shopi' && (
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0D94FB] mb-1">
                      <span>✨</span>
                      <span>Shopi</span>
                    </div>
                  )}
                  <SafeMarkdownRenderer content={msg.text} className={msg.sender === 'user' ? 'text-white' : 'text-slate-100'} />
                </div>

                {/* Timestamp */}
                <span className="text-[10px] text-slate-500 mt-1 px-1">{msg.timestamp}</span>

                {/* EMBEDDED PRODUCT CARDS */}
                {msg.products && msg.products.length > 0 && (
                  <div className="mt-3 w-full space-y-2.5">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
                      Recommended Products ({msg.products.length})
                    </div>
                    <div className="grid grid-cols-1 gap-2.5">
                      {msg.products.map((product, pIdx) => {
                        const prodId = String(product.productId || product.id || `prod_${pIdx}`);
                        const prodTitle = product.title || product.name || 'Product';
                        const isAdding = addingProductId === prodId;
                        const isAdded = addedProductIds.has(prodId);

                        return (
                          <div
                            key={`prod_${msg.id}_${prodId}_${pIdx}`}
                            className="bg-slate-800/80 border border-slate-700 hover:border-slate-600 rounded-2xl p-3 flex gap-3 shadow-lg hover:shadow-xl transition-all group"
                          >
                            {/* Product Thumbnail */}
                            <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-slate-950 border border-slate-700/50 relative">
                              <img
                                src={product.imageUrl}
                                alt={prodTitle}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src =
                                    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&auto=format&fit=crop&q=60';
                                }}
                              />
                              {product.inStock !== false && (
                                <span className="absolute top-1 left-1 bg-emerald-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow">
                                  In Stock
                                </span>
                              )}
                            </div>

                            {/* Product Details & Actions */}
                            <div className="flex-1 flex flex-col justify-between min-w-0">
                              <div>
                                <span className="text-[10px] font-medium text-[#0D94FB] uppercase tracking-wide">
                                  {product.category || 'Apparel'}
                                </span>
                                <h4 className="text-xs font-bold text-white truncate group-hover:text-cyan-300 transition-colors">
                                  {prodTitle}
                                </h4>
                                <div className="mt-1 flex items-baseline gap-2">
                                  <span className="text-sm font-extrabold text-emerald-400">
                                    ₹{product.price.toLocaleString('en-IN')}
                                  </span>
                                  <span className="text-[10px] text-slate-400 uppercase">INR</span>
                                </div>
                              </div>

                              {/* Card Action Buttons */}
                              <div className="mt-2 flex items-center gap-2">
                                <button
                                  onClick={() => handleManualAddToCart(product)}
                                  disabled={isAdding}
                                  className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
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
                                  href={`/product/${prodId}`}
                                  className="py-1.5 px-2.5 bg-slate-700/80 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                                >
                                  <span>View</span>
                                  <span className="text-[10px]">→</span>
                                </Link>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* EMBEDDED REAL CART PREVIEW (Only shown for cart-specific operations) */}
                {msg.cart && (msg.intent === 'check_cart' || msg.intent === 'add_to_cart' || msg.intent === 'remove_from_cart' || msg.intent === 'clear_cart' || msg.intent === 'check_last_added') && (
                  <div className="mt-3 w-full bg-slate-800/90 border border-emerald-500/40 rounded-2xl p-3.5 shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-700/80 pb-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">🛒</span>
                        <span className="text-xs font-bold text-white">Your Shopping Cart</span>
                      </div>
                      <span className="text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        {msg.cart.itemCount} item(s)
                      </span>
                    </div>

                    {/* Cart Items Summary */}
                    {msg.cart.items.length === 0 ? (
                      <p className="text-xs text-slate-400 py-1 italic">Your cart is currently empty.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                        {msg.cart.items.map((item, itemIdx) => (
                          <div key={`cart_item_${msg.id}_${item.cartItemId || item.productId}_${itemIdx}`} className="flex items-center justify-between text-xs text-slate-200">
                            <span className="truncate max-w-[200px] text-slate-300">
                              {item.name} <span className="text-slate-500 font-mono">×{item.quantity}</span>
                            </span>
                            <span className="font-semibold text-emerald-400">
                              ₹{item.itemTotal.toLocaleString('en-IN')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Cart Total & Action Buttons */}
                    <div className="mt-3 pt-2 border-t border-slate-700/80 flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Cart Total:</span>
                      <span className="text-sm font-extrabold text-emerald-400">
                        ₹{msg.cart.total.toLocaleString('en-IN')} INR
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          toggleCart();
                        }}
                        className="py-1.5 px-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-xl text-center transition-colors cursor-pointer"
                      >
                        Open Cart Drawer
                      </button>
                      <Link
                        href="/cart-checkout"
                        onClick={() => setIsOpen(false)}
                        className="py-1.5 px-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-semibold rounded-xl text-center transition-all shadow-md shadow-emerald-500/20"
                      >
                        Checkout →
                      </Link>
                    </div>
                  </div>
                )}

                {/* Standalone Checkout Action Card (Only shown for checkout intents) */}
                {msg.checkout && msg.checkout.available && (msg.intent === 'checkout' || msg.intent === 'address_selected') && (
                  <div className="mt-3 p-3 bg-gradient-to-r from-emerald-950/40 to-teal-950/40 border border-emerald-500/30 rounded-2xl">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span className="text-sm">🛒</span> Order Ready for Checkout
                      </span>
                      {msg.checkout.total !== undefined && msg.checkout.total > 0 && (
                        <span className="text-xs font-extrabold text-emerald-400">
                          ₹{msg.checkout.total.toLocaleString('en-IN')} INR
                        </span>
                      )}
                    </div>
                    <Link
                      href={msg.checkout.url || "/cart-checkout"}
                      onClick={() => setIsOpen(false)}
                      className="w-full block py-2 px-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold rounded-xl text-center transition-all shadow-md shadow-emerald-500/20 active:scale-[0.98]"
                    >
                      Proceed to Checkout →
                    </Link>
                  </div>
                )}

                {/* Address List Card */}
                {msg.addresses && msg.addresses.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {msg.addresses.map((addr, addrIdx) => (
                      <div key={`addr_${msg.id}_${addr.addressID || addrIdx}_${addrIdx}`} className="p-2.5 bg-slate-800/80 border border-slate-700/70 rounded-xl text-xs">
                        <div className="flex items-center justify-between font-bold text-white mb-0.5">
                          <span>{addr.userName}</span>
                          {addr.is_default && (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/40 font-semibold">
                              Default
                            </span>
                          )}
                        </div>
                        <div className="text-slate-300 text-[11px] leading-relaxed">
                          {addr.addressLine1}{addr.addressLine2 ? `, ${addr.addressLine2}` : ''}<br />
                          {addr.city}, {addr.state} - {addr.postalCode}
                        </div>
                      </div>
                    ))}
                    <Link
                      href="/cart-checkout"
                      onClick={() => setIsOpen(false)}
                      className="w-full block py-2 px-3 bg-gradient-to-r from-[#012652] to-[#0D94FB] hover:from-[#011d3f] hover:to-[#0B80D8] text-white text-xs font-bold rounded-xl text-center transition-all shadow-md shadow-[#0D94FB]/20 active:scale-[0.98]"
                    >
                      Continue to Checkout →
                    </Link>
                  </div>
                )}

                {/* Selected Address Card */}
                {msg.selectedAddress && !msg.addresses && (
                  <div className="mt-3 p-3 bg-slate-800/80 border border-slate-700/70 rounded-xl text-xs">
                    <div className="font-bold text-white mb-1 flex items-center justify-between">
                      <span>📍 {msg.selectedAddress.userName}</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/40 font-semibold">
                        Selected Address
                      </span>
                    </div>
                    <div className="text-slate-300 text-[11px] leading-relaxed mb-2.5">
                      {msg.selectedAddress.addressLine1}{msg.selectedAddress.addressLine2 ? `, ${msg.selectedAddress.addressLine2}` : ''}<br />
                      {msg.selectedAddress.city}, {msg.selectedAddress.state} - {msg.selectedAddress.postalCode}
                    </div>
                    <Link
                      href="/cart-checkout"
                      onClick={() => setIsOpen(false)}
                      className="w-full block py-2 px-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold rounded-xl text-center transition-all shadow-md shadow-emerald-500/20 active:scale-[0.98]"
                    >
                      Proceed to Checkout →
                    </Link>
                  </div>
                )}
              </div>
            ))}

            {/* TYPING / THINKING INDICATOR */}
            {isLoading && (
              <div className="flex items-center gap-2 text-slate-400 bg-slate-800/80 border border-slate-700/60 rounded-2xl rounded-tl-xs px-4 py-3 w-fit text-xs">
                <span className="animate-spin text-sm">✨</span>
                <span className="font-medium">Shopi is searching the store catalog...</span>
                <div className="flex gap-1 ml-1">
                  <span className="w-1.5 h-1.5 bg-[#0D94FB] rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 bg-[#012652] rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            )}

            {/* QUICK ACTIONS ON START */}
            {messages.length <= 1 && !isLoading && (
              <div className="pt-2">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Quick Shopping Suggestions
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ACTIONS.map((action, idx) => (
                    <button
                      key={`qa_${action.label}_${idx}`}
                      onClick={() => handleSendMessage(action.prompt)}
                      className="px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 hover:border-[#0D94FB]/50 text-slate-200 text-xs rounded-xl transition-all cursor-pointer text-left hover:scale-[1.02]"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* INPUT FORM AREA */}
          <div className="bg-slate-900/95 border-t border-slate-800 p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Shopi... e.g. 'Find running shoes under ₹3000'"
                disabled={isLoading}
                className="flex-1 bg-slate-800/90 border border-slate-700/80 focus:border-[#0D94FB] focus:ring-1 focus:ring-[#0D94FB] text-white placeholder-slate-400 text-xs rounded-2xl px-4 py-3 focus:outline-none transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="w-10 h-10 shrink-0 bg-gradient-to-r from-[#012652] to-[#0D94FB] hover:from-[#011d3f] hover:to-[#0B80D8] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-[#0D94FB]/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                aria-label="Send message"
              >
                <i className="fa-solid fa-paper-plane text-xs"></i>
              </button>
            </form>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500 px-1">
              <span>Personal AI Shopping Assistant</span>
              <span>All prices in ₹ INR</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
