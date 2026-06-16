document.addEventListener("DOMContentLoaded", () => {
    const glossaryList = document.getElementById('glossaryList');
    const searchInput = document.getElementById('searchInput');
    const resultCount = document.getElementById('resultCount');
    const alphabetNav = document.getElementById('alphabetNav');
    const termIndexList = document.getElementById('termIndexList');

    let terms = [];
    let currentLetterFilter = 'A';
    let currentSearchQuery = '';

    // CSV Parser function
    function parseCSV(text) {
        const lines = [];
        let currentLine = [];
        let currentCell = '';
        let inQuotes = false;
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            
            if (inQuotes) {
                if (char === '"') {
                    if (i + 1 < text.length && text[i + 1] === '"') {
                        currentCell += '"';
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    currentCell += char;
                }
            } else {
                if (char === '"') {
                    inQuotes = true;
                } else if (char === ',') {
                    currentLine.push(currentCell.trim());
                    currentCell = '';
                } else if (char === '\r') {
                    // ignore
                } else if (char === '\n') {
                    currentLine.push(currentCell.trim());
                    if(currentLine.join('').length > 0) {
                        lines.push(currentLine);
                    }
                    currentLine = [];
                    currentCell = '';
                } else {
                    currentCell += char;
                }
            }
        }
        if (currentCell !== '' || currentLine.length > 0) {
            currentLine.push(currentCell.trim());
            if(currentLine.join('').length > 0) {
                lines.push(currentLine);
            }
        }
        
        if (lines.length < 2) return [];
        
        const headers = lines[0];
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const obj = {};
            for (let j = 0; j < headers.length; j++) {
                obj[headers[j]] = lines[i][j] || '';
            }
            data.push(obj);
        }
        return data;
    }

    // Fetch the CSV directly from the exact location
    fetch('glossary_terms.csv')
        .then(response => {
            if (!response.ok) {
                throw new Error("Could not load glossary_terms.csv");
            }
            return response.text();
        })
        .then(csvText => {
            terms = parseCSV(csvText);
            
            // Clean out completely empty objects or ones without term names
            terms = terms.filter(t => t['Term name'] && t['Term name'].trim() !== '');

            // Sort alphabetically
            terms.sort((a, b) => {
                const nameA = a['Term name'].toUpperCase();
                const nameB = b['Term name'].toUpperCase();
                if (nameA < nameB) return -1;
                if (nameA > nameB) return 1;
                return 0;
            });

            initApp();
        })
        .catch(err => {
            console.error(err);
            glossaryList.innerHTML = `<div class="no-results" style="color:red;">Error loading terms: ${err.message}</div>`;
        });

    function initApp() {
        generateSidebarIndex();
        generateAlphabetNav();
        renderTerms();
    }

    const generateSidebarIndex = () => {
        termIndexList.innerHTML = '';
        terms.forEach((item) => {
            const btn = document.createElement('button');
            btn.className = 'sidebar-link';
            btn.textContent = item['Term name'];
            btn.addEventListener('click', () => {
                searchInput.value = item['Term name'];
                currentSearchQuery = item['Term name'];
                currentLetterFilter = null;
                updateActiveAlphaBtn(alphabetNav.querySelector('.alpha-btn:first-child')); 
                
                const allSidebarLinks = termIndexList.querySelectorAll('.sidebar-link');
                allSidebarLinks.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                renderTerms();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
            termIndexList.appendChild(btn);
        });
    };

    const generateAlphabetNav = () => {
        const letters = new Set();
        terms.forEach(term => {
            const name = term['Term name'];
            if (name && name.length > 0) {
                letters.add(name.charAt(0).toUpperCase());
            }
        });
        
        const sortedLetters = Array.from(letters).sort();
        
        const allBtn = document.createElement('button');
        allBtn.className = currentLetterFilter === null ? 'alpha-btn active' : 'alpha-btn';
        allBtn.textContent = 'All';
        allBtn.addEventListener('click', () => {
            currentLetterFilter = null;
            updateActiveAlphaBtn(allBtn);
            searchInput.value = '';
            currentSearchQuery = '';
            
            const allSidebarLinks = termIndexList.querySelectorAll('.sidebar-link');
            allSidebarLinks.forEach(b => b.classList.remove('active'));

            renderTerms();
        });
        alphabetNav.appendChild(allBtn);

        sortedLetters.forEach(letter => {
            const btn = document.createElement('button');
            btn.className = currentLetterFilter === letter ? 'alpha-btn active' : 'alpha-btn';
            btn.textContent = letter;
            btn.addEventListener('click', () => {
                currentLetterFilter = letter;
                updateActiveAlphaBtn(btn);
                
                searchInput.value = '';
                currentSearchQuery = '';
                
                const allSidebarLinks = termIndexList.querySelectorAll('.sidebar-link');
                allSidebarLinks.forEach(b => b.classList.remove('active'));

                renderTerms();
            });
            alphabetNav.appendChild(btn);
        });
    };

    const updateActiveAlphaBtn = (activeBtn) => {
        const btns = alphabetNav.querySelectorAll('.alpha-btn');
        if(btns.length === 0) return;
        btns.forEach(b => b.classList.remove('active'));
        if(activeBtn) {
            activeBtn.classList.add('active');
        }
    };

    const highlight = (text, query) => {
        if (!text) return '';
        if (!query) return text;
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    };

    const renderTerms = () => {
        glossaryList.innerHTML = '';
        
        const q = currentSearchQuery.toLowerCase();
        
        const filtered = terms.filter(item => {
            if (currentLetterFilter) {
                const name = item['Term name'] || '';
                if (!name.toUpperCase().startsWith(currentLetterFilter)) {
                    return false;
                }
            }
            if (!q) return true;
            
            return (item['Term name'] && item['Term name'].toLowerCase().includes(q)) ||
                   (item['Short name'] && item['Short name'].toLowerCase().includes(q)) ||
                   (item['Context'] && item['Context'].toLowerCase().includes(q)) ||
                   (item['Source'] && item['Source'].toLowerCase().includes(q)) ||
                   (item['Related term'] && item['Related term'].toLowerCase().includes(q));
        });

        if (filtered.length === 0) {
            resultCount.textContent = '0 terms found';
            glossaryList.innerHTML = `<div class="no-results">No terms match your search criteria. Try a different term!</div>`;
            return;
        }

        resultCount.textContent = `${filtered.length} term${filtered.length !== 1 ? 's' : ''} found`;

        filtered.forEach((item) => {
            const card = document.createElement('div');
            card.className = 'glossary-card';
            
            card.innerHTML = `
                <div class="card-header">
                    <div>
                        <div class="term-title">${highlight(item['Term name'], currentSearchQuery)}</div>
                        ${item['Short name'] ? `<div class="term-shortname">${highlight(item['Short name'], currentSearchQuery)}</div>` : ''}
                    </div>
                    <svg class="expand-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
                <div class="card-body">
                    <div class="context-text">${highlight(item['Context'], currentSearchQuery)}</div>
                    ${item['Related term'] ? `
                    <div class="meta-info">
                        <span class="meta-label">Related Term:</span> 
                        <span class="meta-value">${highlight(item['Related term'], currentSearchQuery)}</span>
                    </div>` : ''}
                    ${item['Source'] ? `
                    <div class="meta-info">
                        <span class="meta-label">Source:</span> 
                        <span class="meta-value">${highlight(item['Source'], currentSearchQuery)}</span>
                    </div>` : ''}
                    <div class="card-footer">
                        ${item['Partner information'] ? `<span><strong>Partner:</strong> ${item['Partner information']}</span>` : ''}
                    </div>
                </div>
            `;

            if (currentSearchQuery !== '' && filtered.length === 1) {
                card.classList.add('expanded');
            }

            card.addEventListener('click', (e) => {
                if(e.target.closest('a')) return;
                card.classList.toggle('expanded');
            });

            glossaryList.appendChild(card);
        });
    };

    let timeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            currentSearchQuery = e.target.value.trim();
            
            const allSidebarLinks = termIndexList.querySelectorAll('.sidebar-link');
            allSidebarLinks.forEach(b => b.classList.remove('active'));

            renderTerms();
        }, 200);
    });
});
