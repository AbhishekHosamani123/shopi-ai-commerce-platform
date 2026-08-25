import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface option {
  title: string;
  link: string;
}

const Product = ({ options }: { options: option[] }) => {
  const [margin, setMargin] = useState(10);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMargin(0);
      setOpacity(1);
    }, 5);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      id="dropdownAvatar"
      style={{
        marginTop: `${margin * 0.25}rem`,
        opacity: opacity,
        transition: 'margin-top 0.2s ease-in-out, opacity 0.3s ease-in-out',
      }}
      className="z-30 bg-white divide-y divide-gray-100 rounded-lg absolute shadow drop-shadow-xl w-52 py-4 px-2"
    >
      <ul className="py-0 text-sm" aria-labelledby="dropdownUserAvatarButton">
        {options.map((each, index) => (
          <li key={index}>
            <Link
              href={each.link}
              prefetch={true}
              className="block px-4 py-2 text-sm text-slate-600 hover:text-[#0D94FB] transition-colors"
            >
              {each.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Product;
