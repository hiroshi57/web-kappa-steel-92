/**
 * スコア(0-100)の評価ラベル・カラーを一元管理する。
 * 素人でも良し悪しが判断できる S〜D の意味付けを全画面で統一する。
 */

export interface Rating {
  grade: "S" | "A" | "B" | "C" | "D";
  text: string;
  color: string;
}

export function rating(value: number): Rating {
  if (value >= 85) return { grade: "S", text: "非常に優秀", color: "var(--color-success)" };
  if (value >= 75) return { grade: "A", text: "優秀", color: "var(--color-success)" };
  if (value >= 60) return { grade: "B", text: "平均以上", color: "var(--color-accent)" };
  if (value >= 45) return { grade: "C", text: "平均的", color: "var(--color-warning)" };
  return { grade: "D", text: "要改善", color: "var(--color-danger)" };
}
