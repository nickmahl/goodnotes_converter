document.getElementById('file-input').addEventListener('change', handleFileSelect);

async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    // Reset output and progress bar
    const outputDiv = document.getElementById('output');
    outputDiv.innerHTML = '';
    updateProgressBar(0);
    showProgressBar(true);

    try {
      // Initialize JSZip
      const zip = new JSZip();

      // Read the file using FileReader
      const reader = new FileReader();
      reader.onload = async function(e) {
        try {
          // Load the ZIP content
          await zip.loadAsync(e.target.result);

          // Get all files in the attachments folder
          const filesInAttachments = [];
          zip.folder('attachments').forEach(function(relativePath, file) {
            filesInAttachments.push(file);
          });

          if (filesInAttachments.length === 0) {
            alert('No files found in the attachments folder.');
            showProgressBar(false);
            return;
          }

          // Identify PDF files by checking their content
          let processedFiles = 0;
          const totalFiles = filesInAttachments.length;
          const pdfFiles = [];

          for (const file of filesInAttachments) {
            const content = await file.async('arraybuffer');
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
              pdfFiles.push({ file: file, content: content });
            }

            processedFiles++;
            updateProgressBar((processedFiles / totalFiles) * 50); // Updating progress to 50% during extraction
          }

          if (pdfFiles.length === 0) {
            alert('No PDF files found in the attachments folder.');
            showProgressBar(false);
            return;
          }

          // Provide download links for individual PDFs
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
          });

          // Update progress bar to 75%
          updateProgressBar(75);

          // If there are multiple PDFs, offer a combined PDF download
          if (pdfFiles.length > 1) {
            // Merge PDFs using pdf-lib
            const mergedPdf = await PDFLib.PDFDocument.create();

            let mergedProcessed = 0;
            const totalMerges = pdfFiles.length;

            for (const item of pdfFiles) {
              const pdfBytes = item.content;
              const pdf = await PDFLib.PDFDocument.load(pdfBytes);
              const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
              copiedPages.forEach((page) => mergedPdf.addPage(page));

              mergedProcessed++;
              // Update progress bar between 75% and 100%
              updateProgressBar(75 + (mergedProcessed / totalMerges) * 25);
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

          // Update progress bar to 100%
          updateProgressBar(100);

          // Hide progress bar after a short delay
          setTimeout(() => showProgressBar(false), 500);

        } catch (err) {
          alert('Failed to process the GoodNotes file. It may be corrupted.');
          console.error(err);
          showProgressBar(false);
        }
      };

      reader.onerror = function(err) {
        alert('Error reading file.');
        console.error(err);
        showProgressBar(false);
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      alert('An error occurred while processing the file.');
      console.error(err);
      showProgressBar(false);
    }
  }
}

// Functions to control the progress bar
function updateProgressBar(percentage) {
  const progressBar = document.getElementById('progress-bar');
  progressBar.style.width = percentage + '%';
}

function showProgressBar(show) {
  const progressContainer = document.getElementById('progress-container');
  if (show) {
    progressContainer.style.display = 'block';
  } else {
    progressContainer.style.display = 'none';
    updateProgressBar(0);
  }
}
