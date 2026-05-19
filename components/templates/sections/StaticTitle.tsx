"use client";

type StaticTitleProps = {
  title: string;
};

export function StaticTitle({ title }: StaticTitleProps) {
  return (
    <div>
      <h2 className="font-bold text-black m-0">
        {title}
      </h2>
    </div>
  );
}

