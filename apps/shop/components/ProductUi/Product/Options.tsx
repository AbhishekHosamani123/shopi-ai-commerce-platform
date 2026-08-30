import React from 'react';
import { Radio, RadioGroup } from '@headlessui/react';

export interface ProductSize {
    sizeid: number;
    sizename: string;
    instock: boolean;
    availableColors?: string[];
}

export interface ProductColor {
    colorid: number;
    colorname: string;
    colorclass: string;
    imglink?: string | null;
    availableSizes?: string[];
}

interface propType {
    sizes: ProductSize[];
    colors: ProductColor[];
    selectedColor: ProductColor;
    setSelectedColor: (color: ProductColor) => void;
    selectedSize: ProductSize;
    setSelectedSize: (size: ProductSize) => void;
    colRef: any;
    sizeRef: any;
    cartItemData: any;
    onColorChange?: (color: ProductColor) => void;
}

export function formatColorDisplay(name: string): string {
    if (!name || name === 'Default') return '';
    return name
        .split(' ')
        .map(word => {
            if (word === '&' || word === '/') return word;
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');
}

const Options = ({
    sizes,
    colors,
    selectedColor,
    setSelectedColor,
    selectedSize,
    setSelectedSize,
    colRef,
    sizeRef,
    onColorChange
}: propType) => {
    function classNames(...classes: (string | boolean | undefined)[]) {
        return classes.filter(Boolean).join(' ');
    }

    const handleColorClick = (color: ProductColor) => {
        setSelectedColor(color);
        if (colRef) colRef.current = color.colorname;

        // Check if current size is available for the newly selected color
        if (color.availableSizes && color.availableSizes.length > 0 && selectedSize && selectedSize.sizename !== 'Default') {
            const isSizeAvailable = color.availableSizes.some(
                s => s.toLowerCase() === selectedSize.sizename.toLowerCase()
            );
            if (!isSizeAvailable) {
                // Find matching size in sizes array or keep selectedSize with instock=false
                const matchedSize = sizes.find(s => s.sizename.toLowerCase() === selectedSize.sizename.toLowerCase());
                if (matchedSize) {
                    setSelectedSize({ ...matchedSize, instock: false });
                }
            } else {
                const matchedSize = sizes.find(s => s.sizename.toLowerCase() === selectedSize.sizename.toLowerCase());
                if (matchedSize) {
                    setSelectedSize({ ...matchedSize, instock: true });
                }
            }
        }

        if (onColorChange) onColorChange(color);
    };

    const handleSizeClick = (size: ProductSize) => {
        setSelectedSize(size);
        if (sizeRef) sizeRef.current = size.sizename;
    };

    const isCurrentSizeAvailable = () => {
        if (!selectedSize || selectedSize.sizename === 'Default') return true;
        if (!selectedColor?.availableSizes || selectedColor.availableSizes.length === 0) return selectedSize.instock;
        return selectedColor.availableSizes.some(
            s => s.toLowerCase() === selectedSize.sizename.toLowerCase()
        );
    };

    return (
        <section aria-labelledby="options-heading">
            <h3 id="options-heading" className="sr-only">
                Product options
            </h3>

            <div className="space-y-6">
                {/* Colors */}
                {colors && colors.length > 0 && (
                    <fieldset aria-label="Choose a color">
                        <div className="flex items-center justify-between mb-3">
                            <legend className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                <span>Color:</span>
                                <span className="font-bold text-[#0D94FB]">
                                    {formatColorDisplay(selectedColor?.colorname) || 'Select a color'}
                                </span>
                            </legend>
                            <span className="text-xs text-slate-400 font-medium">
                                {colors.length} {colors.length === 1 ? 'color' : 'colors'} available
                            </span>
                        </div>

                        <RadioGroup
                            value={selectedColor}
                            onChange={(color) => handleColorClick(color)}
                            className="flex flex-wrap items-center gap-3"
                        >
                            {colors.map((color) => {
                                const formattedName = formatColorDisplay(color.colorname);
                                const isSelected = selectedColor?.colorid === color.colorid || selectedColor?.colorname === color.colorname;

                                return (
                                    <Radio
                                        key={color.colorid || color.colorname}
                                        value={color}
                                        aria-label={`Color: ${formattedName}`}
                                        title={formattedName}
                                        className={({ focus, checked }) =>
                                            classNames(
                                                'group relative flex cursor-pointer items-center justify-center rounded-xl p-1 focus:outline-none transition-all duration-200 bg-slate-50 border',
                                                checked
                                                    ? 'ring-2 ring-[#0D94FB] border-[#0D94FB] shadow-sm scale-105 bg-white'
                                                    : 'border-slate-200 hover:border-[#0D94FB]/50 hover:shadow-xs',
                                                focus ? 'ring-2 ring-offset-1 ring-[#0D94FB]' : ''
                                            )
                                        }
                                    >
                                        {({ checked }) => (
                                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg flex items-center justify-center p-1 overflow-hidden relative">
                                                {color.imglink ? (
                                                    <img
                                                        src={color.imglink}
                                                        alt={formattedName}
                                                        className="w-full h-full object-contain rounded-md transition-transform duration-200 group-hover:scale-105"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <span
                                                        aria-hidden="true"
                                                        className={classNames(
                                                            color.colorclass || 'bg-slate-700',
                                                            'h-8 w-8 rounded-full border border-black/10 shadow-xs'
                                                        )}
                                                    />
                                                )}
                                                {checked && (
                                                    <span className="absolute top-0.5 right-0.5 bg-[#0D94FB] text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[9px] font-bold shadow-xs">
                                                        ✓
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </Radio>
                                );
                            })}
                        </RadioGroup>
                    </fieldset>
                )}

                {/* Sizes */}
                {sizes && sizes.length > 0 && (
                    <fieldset className="mt-4" aria-label="Choose a size">
                        <div className="flex items-center justify-between mb-3">
                            <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                <span>Size:</span>
                                <span className="font-bold text-[#0D94FB]">
                                    {selectedSize?.sizename || 'Select a size'}
                                </span>
                            </div>
                            {!isCurrentSizeAvailable() && (
                                <span className="text-xs text-rose-500 font-semibold">
                                    Size {selectedSize?.sizename} is unavailable for {formatColorDisplay(selectedColor?.colorname)}
                                </span>
                            )}
                        </div>

                        <RadioGroup
                            value={selectedSize}
                            onChange={(size) => handleSizeClick(size)}
                            className="grid grid-cols-4 gap-2.5 sm:grid-cols-6"
                        >
                            {sizes.map((size) => {
                                const isSizeSupportedByColor = !selectedColor?.availableSizes || selectedColor.availableSizes.length === 0
                                    ? size.instock
                                    : selectedColor.availableSizes.some(s => s.toLowerCase() === size.sizename.toLowerCase());
                                
                                const isAvailable = size.instock && isSizeSupportedByColor;

                                return (
                                    <Radio
                                        key={size.sizeid || size.sizename}
                                        value={size}
                                        disabled={!isAvailable}
                                        className={({ focus, checked }) =>
                                            classNames(
                                                isAvailable
                                                    ? 'cursor-pointer bg-white text-slate-800 shadow-xs hover:border-[#0D94FB]/50 hover:bg-slate-50'
                                                    : 'cursor-not-allowed bg-slate-50 text-slate-300 opacity-60',
                                                checked && isAvailable ? 'ring-2 ring-[#0D94FB] border-[#0D94FB] font-bold text-[#0D94FB] bg-[#0D94FB]/5' : 'border-slate-200',
                                                focus ? 'ring-2 ring-[#0D94FB]' : '',
                                                'group relative flex items-center justify-center rounded-xl border py-2.5 px-3 text-sm font-semibold uppercase focus:outline-none transition-all'
                                            )
                                        }
                                    >
                                        {({ checked, focus }) => (
                                            <>
                                                <span>{size.sizename}</span>
                                                {isAvailable ? (
                                                    <span
                                                        className={classNames(
                                                            checked ? 'border-[#0D94FB]' : 'border-transparent',
                                                            focus ? 'border' : 'border-2',
                                                            'pointer-events-none absolute -inset-px rounded-xl'
                                                        )}
                                                        aria-hidden="true"
                                                    />
                                                ) : (
                                                    <span
                                                        aria-hidden="true"
                                                        className="pointer-events-none absolute -inset-px rounded-xl border-2 border-slate-200"
                                                    >
                                                        <svg
                                                            className="absolute inset-0 h-full w-full stroke-2 text-slate-300"
                                                            viewBox="0 0 100 100"
                                                            preserveAspectRatio="none"
                                                            stroke="currentColor"
                                                        >
                                                            <line x1={0} y1={100} x2={100} y2={0} vectorEffect="non-scaling-stroke" />
                                                        </svg>
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </Radio>
                                );
                            })}
                        </RadioGroup>
                    </fieldset>
                )}
            </div>
        </section>
    );
};

export default Options;