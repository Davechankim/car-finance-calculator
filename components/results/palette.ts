// 결과 탭 공용 항목 색상 — 항목 식별은 인덱스 기반 (같은 방식 여러 항목 구분 가능)
export const ITEM_PALETTE = ['#2563eb', '#059669', '#9333ea', '#d97706', '#dc2626', '#0891b2', '#65a30d', '#db2777'];
export const itemColor = (index: number): string => ITEM_PALETTE[index % ITEM_PALETTE.length];
