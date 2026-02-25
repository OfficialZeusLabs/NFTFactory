"use client";

import { useState } from "react";
import app_logo from "@/assets/images/app_logo.png";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import NavAside from "../NavTools";
import { AiOutlineMenu } from "react-icons/ai";

const TopNavigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navItems = [
    {
      name: "Market Place",
      link: "/marketplace",
      id: 1,
    },
    {
      name: "Launchpad",
      link: "/launchpad",
      id: 2,
    },
    {
      name: "Collections",
      link: "/collections",
      id: 3,
    },
    {
      name: "Subscriptions",
      link: "/subscription",
      id: 4,
    },
  ];

  const menuNav = () => {
    setIsOpen(!isOpen);
  };
  return (
    <div className=" fixed top-0 z-50 w-full py-2 bg-[#1B0A1A]  bg-opacity-60 backdrop-blur-[4px] ">
      <div className="mx-auto justify-between items-center w-[97%] tablet_l:w-[94%] laptop_l:w-[89%] max-w-[1280px] flex">
        <div className="flex gap-9">
          <Link href="/">
            <Image src={app_logo} alt={"app_logo"} height={45} width={45} />
          </Link>
          <div className="flex items-center gap-9">
            <div className="hidden tablet_l:flex gap-6">
              {navItems.map(({ name, link, id }) => (
                <Link href={link} key={id}>
                  <div style={{ color: "white" }} className="text-lg">
                    {name}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
        <div className="hidden tablet_l:flex px-4 gap-8  items-center">
          <NavAside />
        </div>
        <div className="tablet_l:hidden flex cursor-pointer" onClick={menuNav}>
          <AiOutlineMenu className="tablet_l:hidden flex h-7 w-7 items-center" />
        </div>
      </div>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="absolute z-10 tablet_l:hidden flex  top-0 w-full bg-black h-[100dvh]"
        >
          <div className="mx-auto w-[95%]">
            <div
              className="mx-auto w-[96%] mt-5  cursor-pointer"
              onClick={menuNav}
            >
              <AiOutlineMenu className="tablet_l:hidden ml-auto flex h-7 w-7 items-center" />
            </div>
            <div className="flex flex-col gap-6 mt-12">
              {navItems.map(({ name, link, id }) => (
                <Link href={link} key={id} className=" ">
                  <p
                    style={{ color: "white" }}
                    className="text-center text-2xl text-[#FFC72C] hover:text-white"
                  >
                    {name}
                  </p>
                </Link>
              ))}
            </div>
            <div className="mx-auto justify-center mt-10 flex px-4 gap-8  items-center">
              <NavAside />
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default TopNavigation;
