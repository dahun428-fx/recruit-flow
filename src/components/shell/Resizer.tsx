// 드래그 리사이즈 분할선. usePanelSize와 함께 쓴다.
"use client";

import { useState } from "react";
import styles from "../canvas/PipelineView.module.css";

interface Props {
  vertical: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}

export function Resizer({ vertical, onMouseDown }: Props) {
  const [dragging, setDragging] = useState(false);
  return (
    <div
      className={`${styles.rz} ${vertical ? styles.rzV : ""} ${
        dragging ? styles.dragging : ""
      }`}
      onMouseDown={(e) => {
        setDragging(true);
        const up = () => {
          setDragging(false);
          window.removeEventListener("mouseup", up);
        };
        window.addEventListener("mouseup", up);
        onMouseDown(e);
      }}
    />
  );
}
