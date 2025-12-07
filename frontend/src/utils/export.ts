/**
 * Export utilities for CSV and PDF generation
 */

export interface ExportData {
  institution: string;
  timestamp: string;
  riskLevel: string;
  viralScore: number;
  tweetCount: number;
  summary: string;
  keyFindings?: string[];
}

/**
 * Export data to CSV format
 */
export function exportToCSV(data: ExportData[], filename: string = "analysis-export") {
  if (data.length === 0) {
    alert("No data to export");
    return;
  }

  // CSV Headers
  const headers = [
    "Institution",
    "Timestamp",
    "Risk Level",
    "Viral Score",
    "Tweet Count",
    "Summary",
    "Key Findings",
  ];

  // Convert data to CSV rows
  const rows = data.map((item) => {
    const findings = item.keyFindings?.join("; ") || "";
    return [
      item.institution,
      item.timestamp,
      item.riskLevel,
      item.viralScore.toString(),
      item.tweetCount.toString(),
      `"${item.summary.replace(/"/g, '""')}"`, // Escape quotes in CSV
      `"${findings.replace(/"/g, '""')}"`,
    ];
  });

  // Combine headers and rows
  const csvContent = [headers, ...rows]
    .map((row) => row.join(","))
    .join("\n");

  // Create blob and download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}-${new Date().toISOString().split("T")[0]}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export data to PDF format (using browser print functionality)
 * For a full PDF library, consider using jsPDF or pdfkit
 */
export function exportToPDF(data: ExportData[], filename: string = "analysis-export") {
  if (data.length === 0) {
    alert("No data to export");
    return;
  }

  // Create a printable HTML document
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to export PDF");
    return;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Financial Sentinel - Analysis Report</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            color: #333;
          }
          h1 {
            color: #1e293b;
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 10px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
          }
          th {
            background-color: #1e293b;
            color: white;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background-color: #f8f9fa;
          }
          .risk-high {
            color: #ef4444;
            font-weight: bold;
          }
          .risk-medium {
            color: #f59e0b;
            font-weight: bold;
          }
          .risk-low {
            color: #10b981;
            font-weight: bold;
          }
          .summary {
            max-width: 300px;
            word-wrap: break-word;
          }
          @media print {
            body { margin: 0; }
            @page { margin: 1cm; }
          }
        </style>
      </head>
      <body>
        <h1>Financial Sentinel - Analysis Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
        <p>Total Records: ${data.length}</p>
        <table>
          <thead>
            <tr>
              <th>Institution</th>
              <th>Timestamp</th>
              <th>Risk Level</th>
              <th>Viral Score</th>
              <th>Tweet Count</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            ${data
              .map(
                (item) => `
              <tr>
                <td>${item.institution}</td>
                <td>${item.timestamp}</td>
                <td class="risk-${item.riskLevel.toLowerCase()}">${item.riskLevel}</td>
                <td>${item.viralScore}</td>
                <td>${item.tweetCount}</td>
                <td class="summary">${item.summary}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();

  // Wait for content to load, then print
  setTimeout(() => {
    printWindow.print();
    // Optionally close after printing
    // printWindow.close();
  }, 250);
}

