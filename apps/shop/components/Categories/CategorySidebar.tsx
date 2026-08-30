"use client"
import React from 'react';
import Loading from '../Loading';
interface categories {
    categoryid: number;
    name: string;
}

interface CategorySidebarProps {
    categories: categories[];
    loading: boolean;
    selectedCategoryIndex: number;
    setselectedCategoryIndex: React.Dispatch<React.SetStateAction<number>>;
    onSelectCategory?: (id: number, name: string) => void;
    mobileMode: boolean;
}

const CategorySidebar = ({
    categories,
    loading,
    selectedCategoryIndex,
    setselectedCategoryIndex,
    onSelectCategory,
    mobileMode
}: CategorySidebarProps) => {
    return (
        <>
            <div className={`${!mobileMode ? 'hidden' : 'flex'} flex-col lg:flex ${!mobileMode ? 'ml-auto' : 'ml-0'} mb-5`}>
                <div className='border-[1px] rounded-xl h-auto w-[220px] xl:w-[220px] p-[15px]'>
                    <p className='tracking-[2px] font-semibold text-davysilver mb-4 relative'>CATEGORIES</p>
                    {loading && <div className='w-full h-[150px]'>{loading && <div className='absolute left-2 top-0 z-50'><Loading/></div>}</div> }
                        {!loading && categories.map((each,index)=> 
                            <div key={index}>
                                <div className={`flex text-base mb-4 cursor-pointer`}>
                                    <div className='flex justify-between items-center w-[100%] text-[20px]'>
                                        <div className='flex justify-center items-center'>
                                            <button 
                                                onClick={() => {
                                                    if (onSelectCategory) {
                                                        onSelectCategory(each.categoryid, each.name);
                                                    } else {
                                                        setselectedCategoryIndex(each.categoryid);
                                                    }
                                                }}
                                                disabled={loading} 
                                                className={`text-[16px] font-medium transition-colors ${each.categoryid===selectedCategoryIndex ? 'text-black font-semibold' : 'text-silver hover:text-slate-700'} tracking-[1px]`}
                                            >
                                                {each.name}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                </div>
            </div>
        </>
    );
};

export default CategorySidebar;
