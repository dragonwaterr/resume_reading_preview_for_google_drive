// 파일명 후보 ↔ 그리드 항목 대조 (순수 로직, DOM 없음). driveDom이 만든 인덱스를 받는다 (ADR-002, ADR-007).
// gridIndex 항목: { id, label(aria-label), texts(Set: 항목 안의 텍스트) }
const nameMatch = (() => {
  // 바둑판 보기는 label이 "파일명 PDF 추가 정보…"로 시작하고, 목록 보기는 파일명만 담긴 하위 칸이 있다.
  const indexHasName = (entry, name) =>
    entry.label === name || entry.label.startsWith(name + ' ') || entry.texts.has(name);

  // 여러 항목에 걸리는 텍스트("나", "PDF" 같은 일반 텍스트이거나 동명 파일)는 증거로 쓰지 않는다.
  // 정확히 1개 항목에 걸린 텍스트들이 같은 파일을 가리킬 때만 확정한다. 동명 파일은 증거가 없어 null (R-01).
  function pickFileId(gridIndex, names) {
    const ids = new Set();
    const stats = { names: names.length, grid: gridIndex.length, single: 0, ambiguous: 0 };
    for (const name of names) {
      const hits = new Set(gridIndex.filter((entry) => indexHasName(entry, name)).map((entry) => entry.id));
      if (hits.size > 1) stats.ambiguous++;
      if (hits.size !== 1) continue;
      stats.single++;
      ids.add([...hits][0]);
    }
    return { id: ids.size === 1 ? [...ids][0] : null, stats };
  }

  return { indexHasName, pickFileId };
})();

if (typeof module !== 'undefined') module.exports = nameMatch;
