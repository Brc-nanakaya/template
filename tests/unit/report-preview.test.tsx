// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReportPreview } from "@/components/report/ReportPreview";

const SAMPLE_MD = `# タイトル\n\n## セクション1\n\n| 項目 | 値 |\n| --- | --- |\n| A | 100 |\n`;

describe("<ReportPreview />", () => {
  beforeEach(() => {
    // jsdom は window.print を未実装なので最小モックを差し込む
    Object.defineProperty(window, "print", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("renders a preview container with provided markdown", () => {
    render(<ReportPreview markdown={SAMPLE_MD} />);
    const container = screen.getByTestId("report-preview-container");
    expect(container).toBeInTheDocument();
    expect(container).toHaveTextContent("タイトル");
    expect(container).toHaveTextContent("セクション1");
  });

  it("exposes three action buttons with expected data-testids", () => {
    render(<ReportPreview markdown={SAMPLE_MD} />);
    expect(screen.getByTestId("report-btn-download-pdf")).toBeInTheDocument();
    expect(screen.getByTestId("report-btn-copy-md")).toBeInTheDocument();
    expect(screen.getByTestId("report-btn-download-md")).toBeInTheDocument();
  });

  it("invokes window.print when PDF button clicked (default handler)", () => {
    render(<ReportPreview markdown={SAMPLE_MD} />);
    fireEvent.click(screen.getByTestId("report-btn-download-pdf"));
    expect(window.print).toHaveBeenCalledTimes(1);
  });

  it("delegates to custom onDownloadPdf when provided", () => {
    const onDownloadPdf = vi.fn();
    render(<ReportPreview markdown={SAMPLE_MD} onDownloadPdf={onDownloadPdf} />);
    fireEvent.click(screen.getByTestId("report-btn-download-pdf"));
    expect(onDownloadPdf).toHaveBeenCalledTimes(1);
    expect(window.print).not.toHaveBeenCalled();
  });

  it("copies markdown via clipboard API and fires onCopySuccess", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const onCopySuccess = vi.fn();
    render(
      <ReportPreview markdown={SAMPLE_MD} onCopySuccess={onCopySuccess} />,
    );
    fireEvent.click(screen.getByTestId("report-btn-copy-md"));
    await Promise.resolve();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(SAMPLE_MD);
    expect(onCopySuccess).toHaveBeenCalled();
  });

  it("fires onCopyError when clipboard API unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    const onCopyError = vi.fn();
    render(<ReportPreview markdown={SAMPLE_MD} onCopyError={onCopyError} />);
    fireEvent.click(screen.getByTestId("report-btn-copy-md"));
    await Promise.resolve();
    await Promise.resolve();
    expect(onCopyError).toHaveBeenCalled();
  });

  it("downloads markdown via Blob URL with filenameBase", () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    const revokeObjectURL = vi.fn();
    // jsdom は URL.createObjectURL を提供しないため差し替え
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });

    const clickSpy = vi.fn();
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = origCreateElement(tag);
      if (tag === "a") {
        (el as HTMLAnchorElement).click = clickSpy;
      }
      return el;
    });

    render(
      <ReportPreview
        markdown={SAMPLE_MD}
        filenameBase="trust-report_2026-03"
      />,
    );
    fireEvent.click(screen.getByTestId("report-btn-download-md"));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("delegates to custom onDownloadMd when provided", () => {
    const onDownloadMd = vi.fn();
    render(
      <ReportPreview
        markdown={SAMPLE_MD}
        filenameBase="custom"
        onDownloadMd={onDownloadMd}
      />,
    );
    fireEvent.click(screen.getByTestId("report-btn-download-md"));
    expect(onDownloadMd).toHaveBeenCalledWith(SAMPLE_MD, "custom");
  });
});
