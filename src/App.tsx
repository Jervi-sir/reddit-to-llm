import { useEffect, useState } from "react";

type CommentItem = {
  id: string;
  author: string;
  score: number;
  body: string;
  parent_id: string;
  depth: number;
};

type Stats = {
  postScore: number;
  totalComments: number;
  totalCommentScore: number;
  avgCommentScore: number;
  commentsPerScorePoint: number;
};

type Outputs = {
  txt: string;
  toon: string;
  json: string;
};

function normalizeToPostId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed.includes("/") && !trimmed.includes(" ")) return trimmed;

  try {
    const u = new URL(trimmed);
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("comments");
    if (idx === -1 || !parts[idx + 1]) return null;
    return parts[idx + 1];
  } catch {
    return null;
  }
}

function walkComments(items: any[], depth: number, out: CommentItem[]) {
  for (const item of items) {
    if (!item || item.kind !== "t1") continue;
    const c = item.data;

    out.push({
      id: c.id,
      author: c.author || "[deleted]",
      score: c.score,
      body: c.body || "",
      parent_id: c.parent_id,
      depth,
    });

    if (c.replies?.data?.children) {
      walkComments(c.replies.data.children, depth + 1, out);
    }
  }
}

/** LLM-style comment format */
function formatCommentLLM(c: CommentItem): string {
  const depthLabel = `d${c.depth}`;
  const body = c.body.trim();
  if (!body) return "";
  return `[${depthLabel}] u/${c.author}\n${body}\n\n`;
}

/** Compact "toon" comment format (single line per comment) */
function formatCommentToon(c: CommentItem): string {
  const depthLabel = `d${c.depth}`;
  const oneLineBody = c.body.replace(/\s+/g, " ").trim();
  if (!oneLineBody) return "";
  return `${depthLabel} · u/${c.author}: ${oneLineBody}\n`;
}

export default function App() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [metaTitle, setMetaTitle] = useState<string | null>(null);
  const [metaSubreddit, setMetaSubreddit] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<Outputs>({
    txt: "",
    toon: "",
    json: "",
  });
  const [mode, setMode] = useState<"txt" | "toon" | "json">("txt");

  async function fetchThread(raw: string) {
    setLoading(true);
    setError("");
    setStats(null);
    setMetaTitle(null);
    setMetaSubreddit(null);
    setOutputs({ txt: "", toon: "", json: "" });

    const postId = normalizeToPostId(raw);
    if (!postId) {
      setError("Invalid URL or Post ID.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(
        `https://www.reddit.com/comments/${postId}.json?raw_json=1`
      );
      if (!res.ok) {
        setError("Failed to load Reddit thread.");
        setLoading(false);
        return;
      }

      const data = await res.json();
      const post = data[0].data.children[0].data;
      const commentsRaw = data[1].data.children;

      const comments: CommentItem[] = [];
      walkComments(commentsRaw, 0, comments);

      // sort comments by score (top first)
      comments.sort((a, b) => b.score - a.score);

      const totalComments = comments.length;
      const totalCommentScore = comments.reduce(
        (sum, c) => sum + (c.score || 0),
        0
      );
      const avgCommentScore =
        totalComments > 0 ? totalCommentScore / totalComments : 0;
      const commentsPerScorePoint =
        totalCommentScore > 0 ? totalComments / totalCommentScore : 0;

      const newStats: Stats = {
        postScore: post.score,
        totalComments,
        totalCommentScore,
        avgCommentScore,
        commentsPerScorePoint,
      };
      setStats(newStats);

      setMetaTitle(post.title);
      setMetaSubreddit(post.subreddit);

      const postAuthor = post.author ? `u/${post.author}` : "[unknown]";
      const body = (post.selftext || "").trim();

      // ---------- LLM TXT ----------
      let llm = "";
      llm += `TITLE: ${post.title}\n`;
      llm += `SUBREDDIT: r/${post.subreddit}\n`;
      llm += `POST_AUTHOR: ${postAuthor}\n\n`;
      llm += `POST_BODY:\n`;
      llm += body ? `${body}\n\n` : "(no body)\n\n";
      llm += `COMMENTS:\n`;
      llm += `# [dX] u/author\n# comment text\n\n`;
      for (const c of comments) {
        llm += formatCommentLLM(c);
      }
      // collapse multiple newlines to a single newline
      llm = llm.replace(/\n{2,}/g, "\n");

      // ---------- TOON TXT ----------
      let toon = "";
      toon += `TITLE: ${post.title}\n`;
      toon += `SUBREDDIT: r/${post.subreddit}\n`;
      toon += `POST_AUTHOR: ${postAuthor}\n\n`;
      toon += `POST_BODY: `;
      toon += body ? `${body}\n\n` : "(no body)\n\n";
      toon += `COMMENTS:\n`;
      for (const c of comments) {
        toon += formatCommentToon(c);
      }
      toon = toon.replace(/\n{2,}/g, "\n");

      // ---------- JSON ----------
      const jsonObj = {
        title: post.title,
        subreddit: post.subreddit,
        postAuthor,
        body,
        stats: newStats,
        comments: comments.map((c) => ({
          id: c.id,
          author: c.author,
          body: c.body,
          score: c.score,
          depth: c.depth,
          parent_id: c.parent_id,
        })),
      };
      const json = JSON.stringify(jsonObj, null, 2);

      setOutputs({ txt: llm, toon, json });
    } catch (e) {
      console.error(e);
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  function handleClick() {
    if (!input.trim()) {
      setError("Enter a URL or Post ID.");
      return;
    }
    fetchThread(input);
  }

  // auto-load via ?url= or ?id=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get("url");
    const idParam = params.get("id");
    const initial = urlParam || idParam;
    if (initial) {
      setInput(initial);
      fetchThread(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayText = outputs[mode];

  return (
    <div className="layout">
      {/* Top bar */}
      <div className="top-bar">
        <div className="left-controls">
          <input
            className="input"
            placeholder="Reddit URL or postId..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />

          <button className="btn" onClick={handleClick} disabled={loading}>
            {loading ? "Loading..." : "Fetch"}
          </button>

          <select
            className="select"
            value={mode}
            onChange={(e) => setMode(e.target.value as "txt" | "toon" | "json")}
          >
            <option value="txt">LLM text</option>
            <option value="toon">Compact text</option>
            <option value="json">JSON</option>
          </select>

          <button
            className="btn copy-btn"
            onClick={() => navigator.clipboard.writeText(displayText)}
            disabled={!displayText}
          >
            Copy
          </button>

          {error && <div className="error">{error}</div>}
        </div>

        <div className="right-logo">Reddit → LLM</div>
      </div>


      {/* Stats + meta row */}
      <div className="stats-row">
        <div className="stats-left">
          {metaTitle && (
            <div className="stats-title">
              {metaTitle}
              {metaSubreddit && (
                <span className="stats-sub">
                  {" "}
                  · r/{metaSubreddit}
                </span>
              )}
            </div>
          )}
        </div>
        {stats && (
          <div className="stats-right">
            <span>Post score: {stats.postScore}</span>
            <span>Comments: {stats.totalComments}</span>
            <span>Sum comment scores: {stats.totalCommentScore}</span>
            <span>
              Avg comment score: {stats.avgCommentScore.toFixed(2)}
            </span>
            <span>
              Comments / score: {stats.commentsPerScorePoint.toFixed(3)}
            </span>
          </div>
        )}
      </div>

      {/* Main text area fills the rest */}
      <textarea
        readOnly
        className="output"
        value={displayText}
        placeholder="Result will appear here…"
      />
    </div>
  );
}
