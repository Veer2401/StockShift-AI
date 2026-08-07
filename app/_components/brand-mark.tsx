import React from "react";

interface BrandMarkProps {
  className?: string;
  strokeClassName?: string;
}

export function BrandMark({
  className = "h-6 w-6",
  strokeClassName = "text-black",
}: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${strokeClassName}`}
      aria-hidden="true"
    >
      <path
        d="M4 8.5L12 4L20 8.5V15.5L12 20L4 15.5V8.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 8.5L12 13L20 8.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 13V20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 9.4L12 8L14.5 9.4L12 10.8L9.5 9.4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
