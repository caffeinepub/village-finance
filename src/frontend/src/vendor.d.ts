declare module "jspdf" {
  class jsPDF {
    constructor(options?: any);
    text(text: string, x: number, y: number, options?: any): this;
    setFontSize(size: number): this;
    setTextColor(...args: any[]): this;
    setLineWidth(width: number): this;
    setDrawColor(...args: any[]): this;
    line(x1: number, y1: number, x2: number, y2: number): this;
    save(filename: string): void;
    setPage(page: number): void;
    internal: any;
    lastAutoTable: any;
  }
  export default jsPDF;
}

declare module "jspdf-autotable" {
  const autoTable: (doc: any, options: any) => void;
  export default autoTable;
}
