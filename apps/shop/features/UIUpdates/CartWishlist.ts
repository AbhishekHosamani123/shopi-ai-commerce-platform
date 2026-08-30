import { createSlice, PayloadAction } from '@reduxjs/toolkit'

// Define interfaces for the items in cart and wishlist
interface Item {
  cartItemID:number;
  productID:number | string;
  productImg:string;
  productAlt:string;
  productName:string;
  productPrice:number;
  productColor:string;
  productSize:string;
  // addedAt:string;
  quantity: number;
}
interface Wishlist{
  wishlistItemID:number;
  productID:number | string;
  productImg:string;
  productAlt:string;
  productName:string;
  productPrice:number;
}

export interface ActiveProductContext {
  sku?: string;
  title?: string;
  price?: number;
  mrp?: number;
  category?: string;
  selectedColor?: string;
  selectedSize?: string;
  selectedVariantImage?: string;
}

interface CartWishlistState {
  cart: Item[];
  wishlist: Wishlist[];
  activeProductContext: ActiveProductContext | null;
}

// Initial state
const initialState: CartWishlistState = {
  cart: [],
  wishlist: [],
  activeProductContext: null,
}

// Create the slice
const cartWishlistSlice = createSlice({
  name: 'cartWishlist',
  initialState,
  reducers: {
    setCart(state, action: PayloadAction<Item[]>) {
      state.cart = action.payload
    },
    setWishlist(state, action: PayloadAction<Wishlist[]>) {
      state.wishlist = action.payload
    },
    setActiveProductContext(state, action: PayloadAction<ActiveProductContext | null>) {
      state.activeProductContext = action.payload
    },
    clearActiveProductContext(state) {
      state.activeProductContext = null
    },
    addItemToCart(state, action: PayloadAction<Item>) {
      const existingItem = state.cart.find(
        item => (item.cartItemID && action.payload.cartItemID && item.cartItemID === action.payload.cartItemID) ||
                (String(item.productID).toUpperCase() === String(action.payload.productID).toUpperCase() && 
                 (item.productColor || 'Standard').toLowerCase() === (action.payload.productColor || 'Standard').toLowerCase() && 
                 (item.productSize || 'Standard').toLowerCase() === (action.payload.productSize || 'Standard').toLowerCase())
      );
      if (existingItem) {
        existingItem.quantity += action.payload.quantity;
      } else {
        state.cart.push(action.payload);
      }
    },
    removeItemFromCart(state, action: PayloadAction<number | string>) {
      state.cart = state.cart.filter(
        item => item.productID !== action.payload && item.cartItemID !== action.payload
      );
    },
    updateCartItemQuantity(state, action: PayloadAction<{ id: number | string, quantity: number }>) {
      const item = state.cart.find(
        item => item.productID === action.payload.id || item.cartItemID === action.payload.id
      );
      if (item) {
        item.quantity = action.payload.quantity;
      }
    },
    addItemToWishlist(state, action: PayloadAction<Wishlist>) {
      const existingItem = state.wishlist.find(item => item.productID === action.payload.productID)
      if (!existingItem) {
        state.wishlist.push(action.payload)
      }
    },
    removeItemFromWishlist(state, action: PayloadAction<number | string>) {
      state.wishlist = state.wishlist.filter(item => item.productID !== action.payload)
    },
  },
})

// Export the actions
export const { 
  setCart,
  setWishlist,
  setActiveProductContext,
  clearActiveProductContext,
  addItemToCart, 
  removeItemFromCart, 
  updateCartItemQuantity, 
  addItemToWishlist, 
  removeItemFromWishlist 
} = cartWishlistSlice.actions

// Export the reducer
export default cartWishlistSlice.reducer