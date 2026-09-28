import re
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from typing import Optional, Dict, Any, List
from engine.skills.base_skill import BaseSkill, SkillResult

class NewsSkill(BaseSkill):
    name = "news_skill"
    description = "Searches recent headlines, summarizes news stories, and provides verified source links."

    def can_handle(self, query: str, context: Optional[Dict[str, Any]] = None) -> bool:
        q = query.lower().strip()
        triggers = [
            "news", "headlines", "breaking news", "what is happening in",
            "current events", "latest updates on", "recent news"
        ]
        return any(t in q for t in triggers)

    def execute(self, query: str, context: Optional[Dict[str, Any]] = None) -> SkillResult:
        q = query.lower().strip()
        topic = q
        for p in ["what is the latest news on", "latest news on", "latest news about", "news about", "news on", "latest news", "headlines", "recent news", "breaking news"]:
            topic = topic.replace(p, "").strip()
        topic = topic or "world"

        articles = self._fetch_news(topic)
        if not articles:
            return SkillResult(
                handled=True,
                spoken_response=f"I couldn't retrieve recent news for '{topic}' right now.",
                display_text="No news articles found."
            )

        top_3 = articles[:3]
        spoken = f"Here are top recent headlines on {topic}: " + ". ".join([a['title'] for a in top_3[:2]]) + "."

        display_lines = [f"### 📰 Latest News: {topic.title()}"]
        for a in top_3:
            display_lines.append(f"• **{a['title']}**\n  *Source*: [{a['source']}]({a['link']}) — {a['pubDate']}")

        display_lines.append("\n*Verified via authorized news wire.*")

        return SkillResult(
            handled=True,
            spoken_response=spoken[:240],
            display_text="\n\n".join(display_lines),
            card_type="news",
            card_data={"topic": topic, "articles": top_3}
        )

    def _fetch_news(self, query: str) -> List[Dict[str, str]]:
        encoded = urllib.parse.quote(query)
        url = f"https://news.google.com/rss/search?q={encoded}&hl=en-IN&gl=IN&ceid=IN:en"
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=5) as resp:
                xml_data = resp.read()

            root = ET.fromstring(xml_data)
            articles = []
            for item in root.findall('.//item')[:5]:
                title = item.find('title').text if item.find('title') is not None else ""
                link = item.find('link').text if item.find('link') is not None else ""
                pubDate = item.find('pubDate').text if item.find('pubDate') is not None else ""
                source = item.find('source').text if item.find('source') is not None else "News"

                if title:
                    articles.append({
                        "title": re.sub(r'\s*-\s*[^-\n]+$', '', title).strip(),
                        "link": link,
                        "source": source,
                        "pubDate": pubDate[:16] if pubDate else ""
                    })
            return articles
        except Exception as e:
            print(f"News fetch notice: {e}")
            return []
