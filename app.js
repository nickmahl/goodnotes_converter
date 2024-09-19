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

          // Read and parse index.attachments.pb
          const indexFile = zip.file('index.attachments.pb');
          let attachmentOrder = [];
          if (indexFile) {
            const indexContent = await indexFile.async('string');
            // Parse the indexContent to extract the ordered list of attachment paths
            attachmentOrder = parseAttachmentIndex(indexContent);
            // Normalize attachment paths to remove leading slashes
            attachmentOrder = attachmentOrder.map(path => path.replace(/^\//, ''));
          } else {
            console.warn('index.attachments.pb not found. Using default order.');
          }

          // Get all files in the attachments folder
          const filesInAttachments = [];
          zip.folder('attachments').forEach(function(relativePath, file) {
            // Construct the full path
            const fullPath = 'attachments/' + relativePath;
            filesInAttachments.push({ fullPath: fullPath, file: file });
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

          for (const item of filesInAttachments) {
            const content = await item.file.async('arraybuffer');
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
              pdfFiles.push({ fullPath: item.fullPath, file: item.file, content: content });
            }

            processedFiles++;
            updateProgressBar((processedFiles / totalFiles) * 50); // Updating progress to 50% during extraction
          }

          if (pdfFiles.length === 0) {
            alert('No PDF files found in the attachments folder.');
            showProgressBar(false);
            return;
          }

          // Map the pdfFiles by their full path
          const pdfFilesMap = new Map();
          for (const pdfFile of pdfFiles) {
            pdfFilesMap.set(pdfFile.fullPath, pdfFile);
          }

          // Reorder pdfFiles based on attachmentOrder
          if (attachmentOrder.length > 0) {
            const reorderedPdfFiles = [];
            for (const attachmentPath of attachmentOrder) {
              if (pdfFilesMap.has(attachmentPath)) {
                reorderedPdfFiles.push(pdfFilesMap.get(attachmentPath));
              } else {
                console.warn(`Attachment path "${attachmentPath}" not found in pdfFilesMap`);
              }
            }
            if (reorderedPdfFiles.length > 0) {
              // Replace pdfFiles with the reordered list
              pdfFiles.length = 0;
              pdfFiles.push(...reorderedPdfFiles);
            } else {
              console.warn('No matching attachments found in pdfFilesMap based on index.attachments.pb');
            }
          }

          // Provide download links for individual PDFs
          pdfFiles.forEach(function(item, index) {
            const blob = new Blob([item.content], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            // Extract file name from relative path and append .pdf
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

// Updated parseAttachmentIndex function
function parseAttachmentIndex(indexContent) {
  const attachmentPaths = [];

  // Split the content into lines
  const lines = indexContent.split('\n');

  // Regular expression to match attachment paths
  const regex = /attachments\/[A-Za-z0-9\-]+/g;

  for (let line of lines) {
    line = line.endsWith('X') ? line.slice(0, -1) : line;

    const matches = line.match(regex);
    if (matches) {
      attachmentPaths.push(...matches);
    }
  }

  return attachmentPaths;
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
