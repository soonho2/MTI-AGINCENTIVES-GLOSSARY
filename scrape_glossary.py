import urllib.request
from bs4 import BeautifulSoup
import re
import csv
import ssl
import time

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

base_url = 'https://web.archive.org/web/20250612194758/https://www.agincentives.org/glossary/'
print("Fetching glossary list...")

def fetch_url(url, retries=5, delay=5):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            return urllib.request.urlopen(req, context=ctx, timeout=30).read().decode('utf-8')
        except Exception as e:
            print(f"Retry {i+1} failed for {url}: {e}")
            time.sleep(delay)
    raise Exception(f"Failed to fetch {url}")

html = fetch_url(base_url)
soup = BeautifulSoup(html, 'html.parser')

links = []
for a in soup.find_all('a', href=True):
    href = a['href']
    if '2022/11/16' in href and href not in links:
        links.append(href)

print(f"Found {len(links)} links.")

data = []
for idx, link in enumerate(links):
    print(f"Scraping [{idx+1}/{len(links)}]: {link}")
    try:
        page_html = fetch_url(link, delay=10)
        page_soup = BeautifulSoup(page_html, 'html.parser')
        
        term_name = ''
        h1 = page_soup.find('h1')
        if h1:
            term_name = h1.text.strip()
            
        # Find the content div
        content_div = None
        for div in page_soup.find_all('div', class_='content'):
            if 'Short name:' in div.text or 'Source:' in div.text or 'Context:' in div.text:
                content_div = div
                break
                
        if not content_div:
            # Fallback to the first div with Short name text
            p = page_soup.find(string=re.compile('Short name|Source', re.IGNORECASE))
            if p:
                content_div = p.parent.parent.parent
                
        text = content_div.text if content_div else page_soup.text
        
        # Cleanup text: replace multiple newlines with a single newline, but keep it structured
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        
        short_name = ''
        context = ''
        source = ''
        related_term = ''
        partner_info = ''
        
        current_section = 'description'
        description_lines = []
        
        for i, line in enumerate(lines):
            line_lower = line.lower()
            if line_lower.startswith('short name:'):
                current_section = 'short_name'
                short_name = line[len('short name:'):].strip()
            elif line_lower == 'short name':
                current_section = 'short_name'
            elif line_lower.startswith('source:'):
                current_section = 'source'
                source = line[len('source:'):].strip()
            elif line_lower == 'source':
                current_section = 'source'
            elif line_lower.startswith('related term :') or line_lower.startswith('related term:'):
                current_section = 'related_term'
                related_term = line.split(':', 1)[1].strip()
            elif line_lower == 'related term' or line_lower == 'related term :':
                current_section = 'related_term'
            elif line_lower.startswith('partner:') or line_lower.startswith('partner information:'):
                current_section = 'partner'
                partner_info = line.split(':', 1)[1].strip()
            elif line_lower == 'partner' or line_lower == 'partner information':
                current_section = 'partner'
            elif line_lower.startswith('context:'):
                current_section = 'context'
                description_lines.append(line)
            else:
                if current_section == 'short_name':
                    if not short_name:
                        short_name = line
                    else:
                        current_section = 'description'
                        description_lines.append(line)
                elif current_section == 'source':
                    if not source:
                        source = line
                    else:
                        source += " " + line
                elif current_section == 'related_term':
                    if not related_term:
                        related_term = line
                    else:
                        related_term += " " + line
                elif current_section == 'partner':
                    if not partner_info:
                        partner_info = line
                    else:
                        partner_info += " " + line
                elif current_section == 'description' or current_section == 'context':
                    description_lines.append(line)
                    
        context_text = " ".join(description_lines).strip()
        
        data.append({
            'Term name': term_name,
            'Short name': short_name,
            'Context': context_text,
            'Source': source,
            'Related term': related_term,
            'Partner information': partner_info,
            'URL': link
        })
        time.sleep(2) # delay between successes
    except Exception as e:
        print(f"Error scraping {link}: {e}")

output_csv = 'glossary_terms.csv'
print(f"Writing {len(data)} items to {output_csv}")
with open(output_csv, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=['Term name', 'Short name', 'Context', 'Source', 'Related term', 'Partner information', 'URL'])
    writer.writeheader()
    writer.writerows(data)
print("Done.")
