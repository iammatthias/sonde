// OG Image Templates for Takumi
// JSX components that render to PNG via Takumi's ImageResponse
// NOTE: Takumi uses Yoga layout (like React Native) - no fit-content, auto width, or CSS grid

// Color palette matching the app design
const colors = {
  bg: "#f8f7f4",
  surface: "#ffffff",
  border: "#e2e1dc",
  borderLight: "#f0efec",
  text: "#1c1c1a",
  text2: "#706f6a",
  text3: "#87867f",
  accent: "#3B82F6",
  accentLight: "#60A5FA",
  accentDark: "#1D4ED8",
  dark: "#1c1c1a",
};

// Shared header component
function Header() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: 1200,
        height: 72,
        paddingLeft: 40,
        paddingRight: 40,
        background: colors.dark,
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginRight: 12,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              background: colors.accent,
            }}
          />
          <div
            style={{
              width: 22,
              height: 10,
              background: colors.accent,
              borderRadius: 3,
              marginTop: 4,
            }}
          />
        </div>
        <span style={{ fontSize: 20, fontWeight: 600, color: "#ffffff" }}>
          sonde
        </span>
      </div>
      <span style={{ fontSize: 12, fontFamily: "monospace", color: "#666666" }}>
        sonde.blue
      </span>
    </div>
  );
}

// ============================================
// HOMEPAGE TEMPLATE
// ============================================
export function HomeTemplate() {
  return (
    <div
      style={{
        display: "flex",
        width: 1200,
        height: 630,
        background: colors.bg,
        position: "relative",
      }}
    >
      {/* Grid pattern overlay */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 0,
          left: 0,
          width: 1200,
          height: 630,
          backgroundImage: `linear-gradient(${colors.border} 1px, transparent 1px), linear-gradient(90deg, ${colors.border} 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
          opacity: 0.5,
        }}
      />

      {/* Content */}
      <div
        style={{
          display: "flex",
          width: 1200,
          height: 630,
          padding: 60,
          alignItems: "center",
        }}
      >
        {/* Balloon illustration */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginRight: 80,
          }}
        >
          <div
            style={{
              width: 130,
              height: 130,
              borderRadius: 65,
              background: colors.accent,
            }}
          />
          <div
            style={{
              width: 4,
              height: 80,
              background: colors.accent,
              marginTop: 20,
            }}
          />
          <div
            style={{
              width: 56,
              height: 42,
              background: colors.accent,
              borderRadius: 9,
            }}
          />
        </div>

        {/* Text content */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 88, fontWeight: 600, color: colors.text }}>
            sonde
          </span>
          <span style={{ fontSize: 28, color: colors.text2, marginTop: 16 }}>
            Atmospheric Protocol Explorer
          </span>
          <span
            style={{
              fontSize: 14,
              fontFamily: "monospace",
              color: colors.text3,
              marginTop: 40,
            }}
          >
            Browse DIDs • Repositories • Collections • Records
          </span>
          <div
            style={{
              display: "flex",
              marginTop: 20,
              padding: 12,
              paddingLeft: 24,
              paddingRight: 24,
              background: colors.dark,
              borderRadius: 6,
            }}
          >
            <span
              style={{ fontSize: 16, fontFamily: "monospace", color: "#ffffff" }}
            >
              sonde.blue
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// PROFILE/DID TEMPLATE
// ============================================
interface ProfileData {
  handle: string;
  did: string;
  pds: string;
  avatar?: string;
  collections: string[];  // Just collection names
  collectionCount: number;
}

export function ProfileTemplate(data: ProfileData) {
  const displayHandle = truncate(data.handle, 22);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 1200,
        height: 630,
        background: colors.bg,
      }}
    >
      <Header />

      {/* Main content */}
      <div style={{ display: "flex", width: 1200, height: 488, padding: 40 }}>
        {/* Left column */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 660,
            marginRight: 40,
          }}
        >
          {/* Label */}
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1.3,
              textTransform: "uppercase",
              color: colors.text3,
              fontFamily: "monospace",
              marginBottom: 16,
            }}
          >
            DID DOCUMENT
          </span>

          {/* Profile info */}
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            {/* Avatar */}
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: 12,
                background: colors.border,
                border: `2px solid ${colors.dark}`,
                overflow: "hidden",
                marginRight: 24,
                flexShrink: 0,
              }}
            >
              {data.avatar && (
                <img
                  src={data.avatar}
                  width={100}
                  height={100}
                  style={{ objectFit: "cover" }}
                />
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", width: 520 }}>
              <span style={{ fontSize: 36, fontWeight: 600, color: colors.accent }}>
                @{displayHandle}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontFamily: "monospace",
                  color: colors.text2,
                  marginTop: 8,
                }}
              >
                {truncate(data.did, 42)}
              </span>
              <span style={{ fontSize: 14, color: colors.text3, marginTop: 6 }}>
                PDS: {data.pds}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div
            style={{
              display: "flex",
              marginTop: 32,
              paddingTop: 24,
              borderTop: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 1.1,
                  textTransform: "uppercase",
                  color: colors.text3,
                  fontFamily: "monospace",
                  marginBottom: 4,
                }}
              >
                COLLECTIONS
              </span>
              <span
                style={{
                  fontSize: 48,
                  fontWeight: 600,
                  color: colors.text,
                  fontFamily: "monospace",
                }}
              >
                {data.collectionCount}
              </span>
            </div>
          </div>
        </div>

        {/* Right column - Collections */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 380,
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            padding: 24,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1.1,
              textTransform: "uppercase",
              color: colors.text3,
              fontFamily: "monospace",
              marginBottom: 16,
            }}
          >
            COLLECTIONS
          </span>

          {data.collections.slice(0, 6).map((col, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                paddingTop: 10,
                paddingBottom: 10,
                borderBottom:
                  i < Math.min(data.collections.length, 6) - 1
                    ? `1px solid ${colors.borderLight}`
                    : "none",
              }}
            >
              <span style={{ fontSize: 14, color: colors.text, fontFamily: "monospace" }}>
                {col.split(".").pop()}
              </span>
            </div>
          ))}

          {data.collectionCount > 6 && (
            <div style={{ display: "flex", marginTop: 8 }}>
              <span style={{ fontSize: 12, color: colors.text3 }}>
                +{data.collectionCount - 6} more
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", paddingLeft: 40, paddingBottom: 20 }}>
        <span style={{ fontSize: 13, color: colors.text3 }}>
          View full repository on{" "}
        </span>
        <span style={{ fontSize: 13, color: colors.accent, fontFamily: "monospace", marginLeft: 4 }}>
          sonde.blue
        </span>
      </div>
    </div>
  );
}

// ============================================
// COLLECTION TEMPLATE
// ============================================
interface CollectionData {
  handle: string;
  nsid: string;
  description: string;
  recordCount: number;
  hasMore: boolean;
  recentRecords: Array<{ rkey: string; preview: string; createdAt: string }>;
}

export function CollectionTemplate(data: CollectionData) {
  const displayHandle = truncate(data.handle, 20);
  const collectionName = data.nsid.split(".").pop() || data.nsid;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 1200,
        height: 630,
        background: colors.bg,
      }}
    >
      <Header />

      {/* Main content */}
      <div style={{ display: "flex", width: 1200, height: 488, padding: 40 }}>
        {/* Left column */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 660,
            marginRight: 40,
          }}
        >
          {/* Breadcrumb */}
          <div style={{ display: "flex", marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontFamily: "monospace", color: colors.accent }}>
              @{displayHandle}
            </span>
            <span style={{ fontSize: 14, fontFamily: "monospace", color: colors.border, marginLeft: 6, marginRight: 6 }}>
              /
            </span>
            <span style={{ fontSize: 14, fontFamily: "monospace", color: colors.text }}>
              {collectionName}
            </span>
          </div>

          {/* Collection icon and name */}
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 8,
                background: colors.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 24,
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 28, color: "#ffffff" }}>{"{}"}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", width: 540 }}>
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 600,
                  fontFamily: "monospace",
                  color: colors.text,
                }}
              >
                {collectionName}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontFamily: "monospace",
                  color: colors.text3,
                  marginTop: 4,
                }}
              >
                {data.nsid}
              </span>
              <span style={{ fontSize: 16, color: colors.text2, marginTop: 12 }}>
                {data.description}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div
            style={{
              display: "flex",
              marginTop: 32,
              paddingTop: 24,
              borderTop: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 1.1,
                  textTransform: "uppercase",
                  color: colors.text3,
                  fontFamily: "monospace",
                  marginBottom: 4,
                }}
              >
                RECORDS
              </span>
              <span
                style={{
                  fontSize: 48,
                  fontWeight: 600,
                  color: colors.text,
                  fontFamily: "monospace",
                }}
              >
                {data.hasMore ? `${data.recordCount}+` : data.recordCount}
              </span>
            </div>
          </div>
        </div>

        {/* Right column - Recent records */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 380,
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            padding: 24,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1.1,
              textTransform: "uppercase",
              color: colors.text3,
              fontFamily: "monospace",
              marginBottom: 16,
            }}
          >
            RECENT RECORDS
          </span>

          {data.recentRecords.length === 0 ? (
            <span style={{ fontSize: 14, color: colors.text3 }}>
              No records found
            </span>
          ) : (
            data.recentRecords.map((rec, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: 12,
                  background: colors.bg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 6,
                  marginBottom: i < data.recentRecords.length - 1 ? 10 : 0,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: "monospace",
                      color: colors.accent,
                    }}
                  >
                    {truncate(rec.rkey, 18)}
                  </span>
                  {rec.createdAt && (
                    <span style={{ fontSize: 10, color: colors.text3 }}>
                      {rec.createdAt}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 13, color: colors.text }}>
                  {truncate(rec.preview, 45)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", paddingLeft: 40, paddingBottom: 20 }}>
        <span style={{ fontSize: 13, fontFamily: "monospace", color: colors.accent }}>
          sonde.blue
        </span>
      </div>
    </div>
  );
}

// ============================================
// RECORD TEMPLATE
// ============================================
interface RecordData {
  handle: string;
  nsid: string;
  rkey: string;
  atUri: string;
  cid: string;
  createdAt: string;
  recordPreview: Record<string, unknown>;
}

export function RecordTemplate(data: RecordData) {
  const displayHandle = truncate(data.handle, 18);
  const collectionName = data.nsid.split(".").pop() || data.nsid;

  // Format preview JSON
  const previewJson = JSON.stringify(data.recordPreview, null, 2)
    .split("\n")
    .slice(0, 8)
    .join("\n");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 1200,
        height: 630,
        background: colors.bg,
      }}
    >
      <Header />

      {/* Main content */}
      <div style={{ display: "flex", width: 1200, height: 488, padding: 40 }}>
        {/* Left column */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 660,
            marginRight: 40,
          }}
        >
          {/* Breadcrumb */}
          <div style={{ display: "flex", marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontFamily: "monospace", color: colors.accent }}>
              @{displayHandle}
            </span>
            <span style={{ fontSize: 13, fontFamily: "monospace", color: colors.border, marginLeft: 4, marginRight: 4 }}>
              /
            </span>
            <span style={{ fontSize: 13, fontFamily: "monospace", color: colors.accent }}>
              {collectionName}
            </span>
            <span style={{ fontSize: 13, fontFamily: "monospace", color: colors.border, marginLeft: 4, marginRight: 4 }}>
              /
            </span>
            <span style={{ fontSize: 13, fontFamily: "monospace", color: colors.text }}>
              {truncate(data.rkey, 16)}
            </span>
          </div>

          {/* Record key */}
          <div style={{ display: "flex", flexDirection: "column", marginBottom: 20 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 1.1,
                textTransform: "uppercase",
                color: colors.text3,
                fontFamily: "monospace",
                marginBottom: 6,
              }}
            >
              RECORD KEY
            </span>
            <span
              style={{
                fontSize: 26,
                fontWeight: 600,
                fontFamily: "monospace",
                color: colors.accent,
              }}
            >
              {data.rkey}
            </span>
          </div>

          {/* Record preview */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              padding: 16,
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              flex: 1,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 1.1,
                textTransform: "uppercase",
                color: colors.text3,
                fontFamily: "monospace",
                marginBottom: 10,
              }}
            >
              RECORD DATA
            </span>
            <span
              style={{
                fontSize: 11,
                fontFamily: "monospace",
                color: colors.text2,
                whiteSpace: "pre-wrap",
                lineHeight: 1.5,
              }}
            >
              {previewJson}
            </span>
          </div>
        </div>

        {/* Right column - Metadata */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 380,
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            padding: 24,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1.1,
              textTransform: "uppercase",
              color: colors.text3,
              fontFamily: "monospace",
              marginBottom: 20,
            }}
          >
            METADATA
          </span>

          {/* Collection */}
          <div style={{ display: "flex", flexDirection: "column", marginBottom: 16 }}>
            <span style={{ fontSize: 11, fontFamily: "monospace", color: colors.text3, marginBottom: 4 }}>
              COLLECTION
            </span>
            <span style={{ fontSize: 13, fontFamily: "monospace", color: colors.accent }}>
              {collectionName}
            </span>
          </div>

          <div style={{ width: 332, height: 1, background: colors.borderLight, marginBottom: 16 }} />

          {/* CID */}
          <div style={{ display: "flex", flexDirection: "column", marginBottom: 16 }}>
            <span style={{ fontSize: 11, fontFamily: "monospace", color: colors.text3, marginBottom: 4 }}>
              CID
            </span>
            <span style={{ fontSize: 12, fontFamily: "monospace", color: colors.text2 }}>
              {truncate(data.cid, 24) || "—"}
            </span>
          </div>

          <div style={{ width: 332, height: 1, background: colors.borderLight, marginBottom: 16 }} />

          {/* Created */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 11, fontFamily: "monospace", color: colors.text3, marginBottom: 4 }}>
              CREATED
            </span>
            <span style={{ fontSize: 13, fontFamily: "monospace", color: colors.accent }}>
              {data.createdAt || "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", paddingLeft: 40, paddingBottom: 20 }}>
        <span style={{ fontSize: 13, fontFamily: "monospace", color: colors.accent }}>
          sonde.blue
        </span>
      </div>
    </div>
  );
}

// ============================================
// SEARCH TEMPLATE
// ============================================
interface SearchData {
  query: string;
}

export function SearchTemplate(data: SearchData) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 1200,
        height: 630,
        background: colors.bg,
      }}
    >
      <Header />

      {/* Main content */}
      <div style={{ display: "flex", width: 1200, height: 488, padding: 40, position: "relative" }}>
        <div style={{ display: "flex", flexDirection: "column", width: 600 }}>
          {/* Search label */}
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1.1,
              textTransform: "uppercase",
              color: colors.text3,
              fontFamily: "monospace",
              marginBottom: 16,
            }}
          >
            SEARCH
          </span>

          {/* Search box visual */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: 16,
              paddingLeft: 20,
              paddingRight: 20,
              background: colors.surface,
              border: `2px solid ${colors.dark}`,
              borderRadius: 8,
              marginBottom: 32,
            }}
          >
            <span style={{ fontSize: 22, marginRight: 12 }}>🔍</span>
            <span style={{ fontSize: 20, color: colors.text }}>
              {data.query || "Search the atmosphere..."}
            </span>
          </div>

          {/* Description */}
          <span style={{ fontSize: 18, color: colors.text2, lineHeight: 1.5 }}>
            Search for handles, DIDs, collections, and records across the AT Protocol network.
          </span>
        </div>

        {/* Radar decoration */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            right: 80,
            top: 80,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 280,
              height: 280,
              borderRadius: 140,
              border: `1.5px solid ${colors.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 200,
                height: 200,
                borderRadius: 100,
                border: `1.5px solid ${colors.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  border: `1.5px solid ${colors.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    background: colors.accent,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", paddingLeft: 40, paddingBottom: 20 }}>
        <span style={{ fontSize: 13, fontFamily: "monospace", color: colors.accent }}>
          sonde.blue
        </span>
      </div>
    </div>
  );
}

// ============================================
// ERROR TEMPLATE
// ============================================
interface ErrorData {
  code: string;
  message: string;
}

export function ErrorTemplate(data: ErrorData) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 1200,
        height: 630,
        background: colors.bg,
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      {/* Grid pattern overlay */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 0,
          left: 0,
          width: 1200,
          height: 630,
          backgroundImage: `linear-gradient(${colors.border} 1px, transparent 1px), linear-gradient(90deg, ${colors.border} 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
          opacity: 0.5,
        }}
      />

      {/* Content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Deflated balloon */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 120,
              height: 80,
              borderRadius: 40,
              background: colors.border,
            }}
          />
          <div
            style={{
              width: 4,
              height: 60,
              background: colors.border,
              marginTop: 16,
            }}
          />
          <div
            style={{
              width: 40,
              height: 30,
              background: colors.border,
              border: `2px solid ${colors.text3}`,
              borderRadius: 6,
            }}
          />
        </div>

        {/* Error code */}
        <span
          style={{
            fontSize: 72,
            fontWeight: 600,
            fontFamily: "monospace",
            color: colors.text,
          }}
        >
          {data.code}
        </span>

        {/* Error message */}
        <span
          style={{
            fontSize: 20,
            color: colors.text2,
            marginTop: 12,
          }}
        >
          {data.message}
        </span>

        {/* Domain */}
        <span
          style={{
            fontSize: 14,
            fontFamily: "monospace",
            color: colors.text3,
            marginTop: 40,
          }}
        >
          sonde.blue
        </span>
      </div>
    </div>
  );
}

// Utility function
function truncate(str: string, length: number): string {
  if (!str) return "";
  if (str.length <= length) return str;
  return str.slice(0, length - 3) + "...";
}
