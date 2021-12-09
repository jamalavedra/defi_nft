import { PageHeader } from "antd";
import React from "react";

// displays a page header

export default function Header() {
  return (
    <a href="https://github.com/jamalavedra" target="_blank" rel="noopener noreferrer">
      <PageHeader title="⚔️ Gladiator betting" subTitle="yikes" style={{ cursor: "pointer" }} />
    </a>
  );
}
