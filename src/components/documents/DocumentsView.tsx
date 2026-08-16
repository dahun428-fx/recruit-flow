// 문서 탭(/documents) — 목록 | 마크다운 편집기 | 버전 히스토리.
// 문서 CRUD + 버전 저장(PUT = 새 버전, author=human). M1에서 JD·증거 입력 수단.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { usePanelSize } from "@/hooks/usePanelWidth";
import { Resizer } from "@/components/shell/Resizer";
import type { Document, DocumentDetail } from "@/lib/types";
import styles from "./Documents.module.css";

export function DocumentsView() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  // 인라인 새 문서 이름 입력
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const newNameInputRef = useRef<HTMLInputElement>(null);

  const list = usePanelSize("doclist", {
    initial: 230,
    min: 150,
    maxVw: 0.45,
    grow: "left",
  });
  const versions = usePanelSize("docversions", {
    initial: 210,
    min: 150,
    maxVw: 0.45,
    grow: "right",
  });

  const loadList = useCallback(async () => {
    const items = await api.listDocuments();
    setDocs(items);
    return items;
  }, []);

  useEffect(() => {
    loadList().then((items) => {
      if (items[0]) setSelected(items[0].id);
    });
  }, [loadList]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      setContent("");
      return;
    }
    api.getDocument(selected).then((d) => {
      setDetail(d);
      setContent(d.content);
      setDirty(false);
      setJustSaved(false);
    });
  }, [selected]);

  function startCreating() {
    setCreating(true);
    setNewName("새 문서.md");
    setTimeout(() => {
      newNameInputRef.current?.focus();
      newNameInputRef.current?.select();
    }, 0);
  }

  async function commitCreate() {
    const trimmed = newName.trim();
    if (!trimmed) {
      setCreating(false);
      setNewName("");
      return;
    }
    setCreating(false);
    setNewName("");
    try {
      const doc = await api.createDocument(trimmed, "", "새 문서");
      await loadList();
      setSelected(doc.id);
    } catch {
      // 무시
    }
  }

  function cancelCreate() {
    setCreating(false);
    setNewName("");
  }

  async function saveVersion() {
    if (!selected || !dirty) return;
    setSaving(true);
    try {
      const updated = await api.saveDocument(selected, content, "본문 편집");
      setDetail(updated);
      setDirty(false);
      setJustSaved(true);
      await loadList();
      setTimeout(() => setJustSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.docs}>
      <div className={styles.list} style={{ width: list.size }}>
        <h3>문서 라이브러리</h3>
        {docs.map((d) => (
          <div
            key={d.id}
            className={`${styles.item} ${d.id === selected ? styles.on : ""}`}
            onClick={() => setSelected(d.id)}
            data-testid={`document-list-item-${d.id}`}
          >
            {d.name}
          </div>
        ))}
        {/* 인라인 새 문서 이름 입력 행 */}
        {creating && (
          <div className={styles.item}>
            <input
              ref={newNameInputRef}
              style={{
                border: "1px solid var(--c-agent)",
                borderRadius: 4,
                padding: "2px 6px",
                font: "inherit",
                fontSize: 12,
                width: "100%",
                outline: "none",
                boxSizing: "border-box",
              }}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { void commitCreate(); }
                if (e.key === "Escape") { cancelCreate(); }
                e.stopPropagation();
              }}
              onBlur={() => void commitCreate()}
              placeholder="문서 이름 (예: jd-kakao.md)"
            />
          </div>
        )}
        <div className={styles.itemNew} onClick={startCreating}>
          + 새 문서
        </div>
      </div>
      <Resizer vertical onMouseDown={list.onMouseDown(true)} />

      {detail ? (
        <div className={styles.edit}>
          <div className={styles.editHead}>
            <b>{detail.name}</b>
            {justSaved && <span className={styles.saved}>✓ 저장됨</span>}
            <button
              className={styles.saveBtn}
              onClick={saveVersion}
              disabled={!dirty || saving}
              data-tip="현재 본문을 새 버전으로 저장합니다(주체: 사람)"
            >
              {saving ? "저장 중…" : "버전 저장"}
            </button>
          </div>
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setDirty(true);
            }}
            placeholder="# 제목&#10;&#10;마크다운으로 JD·증거를 작성하세요…"
          />
        </div>
      ) : (
        <div className={styles.empty}>
          왼쪽에서 문서를 선택하거나 새 문서를 만드세요.
        </div>
      )}

      <Resizer vertical onMouseDown={versions.onMouseDown(true)} />
      <div className={styles.versions} style={{ width: versions.size }}>
        <h3>버전 히스토리</h3>
        {detail ? (
          <>
            <div className={styles.ver}>
              <b>v{detail.currentVersion} · 사람</b>
              {new Date(detail.createdAt).toLocaleString("ko-KR")}
              <br />
              현재 본문
            </div>
            <div className={styles.verNote}>
              버전 저장 시 새 버전이 기록됩니다. 전체 버전 목록·LLM 편집
              이력은 M2에서 노출됩니다.
            </div>
          </>
        ) : (
          <div className={styles.verNote}>문서를 선택하세요.</div>
        )}
      </div>
    </div>
  );
}
