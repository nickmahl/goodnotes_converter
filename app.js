document.getElementById('file-input').addEventListener('change', handleFileSelect);

async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    // Initialize JSZip
    const zip = new JSZip();

    // Read the file using FileReader
    const reader = new FileReader();
    reader.onload = function(e) {
      // Load the ZIP content
      zip.loadAsync(e.target.result).then(async function(zip) {
        // Get all files in the attachments folder
        const filesInAttachments = [];
        zip.folder('attachments').forEach(function(relativePath, file) {
          filesInAttachments.push(file);
        });

        if (filesInAttachments.length === 0) {
          alert('No files found in the attachments folder.');
          return;
        }

        // Identify PDF files by checking their content
        const pdfFilesPromises = filesInAttachments.map(function(file) {
          return file.async('arraybuffer').then(function(content) {
            // Check if the file is a PDF
            const uint8Array = new Uint8Array(content);
            const pdfSignature = [0x25, 0x50, 0x44, 0x46, 0x2D]; // Corresponds to '%PDF-'

            let isPDF = true;
            for (let i = 0; i < pdfSignature.length; i++) {
              if (uint8Array[i] !== pdfSignature[i]) {
                isPDF = false;
                break;
              }
            }

            if (isPDF) {
              return { file: file, content: content };
            } else {
              return null;
            }
          });
        });

        // Wait for all checks to complete
        Promise.all(pdfFilesPromises).then(async function(results) {
          // Filter out non-PDF files
          const pdfFiles = results.filter(function(item) {
            return item !== null;
          });

          if (pdfFiles.length === 0) {
            alert('No PDF files found in the attachments folder.');
            return;
          }

          // Provide download links for individual PDFs
          const outputDiv = document.getElementById('output');
          outputDiv.innerHTML = ''; // Clear previous output

          pdfFiles.forEach(function(item, index) {
            const blob = new Blob([item.content], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            // Rename the file to have a .pdf extension
            const fileName = item.file.name + '.pdf';
            link.download = fileName;
            link.textContent = `Download ${fileName}`;
            outputDiv.appendChild(link);
            outputDiv.appendChild(document.createElement('br'));
          });

          // If there are multiple PDFs, offer a combined PDF download
          if (pdfFiles.length > 1) {
            // Merge PDFs using pdf-lib
            const mergedPdf = await PDFLib.PDFDocument.create();

            for (const item of pdfFiles) {
              const pdfBytes = item.content;
              const pdf = await PDFLib.PDFDocument.load(pdfBytes);
              const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
              copiedPages.forEach((page) => mergedPdf.addPage(page));
            }

            const mergedPdfBytes = await mergedPdf.save();
            const mergedBlob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
            const mergedUrl = URL.createObjectURL(mergedBlob);

            // Create a download link for the merged PDF
            const mergedLink = document.createElement('a');
            mergedLink.href = mergedUrl;
            mergedLink.download = 'merged.pdf';
            mergedLink.textContent = 'Download Merged PDF';
            outputDiv.appendChild(document.createElement('br'));
            outputDiv.appendChild(mergedLink);
          }
        });
      }, function(err) {
        alert('Failed to read the GoodNotes file. It may be corrupted.');
        console.error(err);
      });
    };

    reader.onerror = function(err) {
      alert('Error reading file.');
      console.error(err);
    };

    reader.readAsArrayBuffer(file);
  }
}
