document.getElementById('generateButton').addEventListener('click', async () => {
    const prompt = document.getElementById('visionPrompt').value.trim();
    const resultsContainer = document.getElementById('resultsContainer');
    const generateButton = document.getElementById('generateButton');
    resultsContainer.innerHTML = '';

    if (!prompt) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = 'Please enter a prompt.';
        resultsContainer.appendChild(errorDiv);
        return;
    }

    generateButton.disabled = true;
    generateButton.textContent = 'Processing...';

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = errorData.message || 'An error occurred.';
           resultsContainer.appendChild(errorDiv)
            return;
        }

        const data = await response.json();

          if (data.message) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = data.message;
            resultsContainer.appendChild(errorDiv);
            return;
          }


        data.forEach(item => {
          const resultBox = document.createElement('div');
          resultBox.className = 'result-box';
           resultBox.innerHTML = `
            <textarea data-image-number="${item.imageNumber}">${item.imagePrompt}</textarea>
        `;

          resultsContainer.appendChild(resultBox);
        });

    } catch (error) {
           const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = 'An unexpected error occurred.';
           resultsContainer.appendChild(errorDiv)
           console.error("Fetch error:", error)
    } finally {
        generateButton.disabled = false;
        generateButton.textContent = 'Generate Prompts';
    }
});