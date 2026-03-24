import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "jsr-bookmarks-v1";

function readHashSlug() {
    const match = window.location.hash.match(/^#\/jsr\/([a-z0-9-]+)/i);
    return match ? match[1] : "";
}

function loadBookmarks() {
    try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (!saved) {
            return {};
        }

        const parsed = JSON.parse(saved);
        return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch {
        return {};
    }
}

function buildFallbackDetail(item) {
    return {
        slug: item.slug,
        title: item.title,
        description: `${item.tagline} Konten lengkap belum ditambahkan ke file detail terpisah.`,
        bahan: ["Detail bahan belum tersedia pada katalog massal."],
        caraMembuat: [
            "Buka sumber referensi untuk melihat langkah lengkap.",
            "Jika diperlukan, tambahkan file JSON detail agar isi resep tampil lengkap.",
        ],
        manfaat: ["Catatan manfaat belum diisi untuk item ini."],
    };
}

function parseJsonSafely(rawText) {
    try {
        return JSON.parse(rawText);
    } catch {
        return null;
    }
}

function App() {
    const [catalogStatus, setCatalogStatus] = useState("loading");
    const [catalog, setCatalog] = useState([]);
    const [query, setQuery] = useState("");
    const [activeSlug, setActiveSlug] = useState(readHashSlug());
    const [detailState, setDetailState] = useState({ status: "idle", data: null, error: "" });
    const [bookmarks, setBookmarks] = useState(loadBookmarks);
    const deferredQuery = useDeferredValue(query);

    useEffect(() => {
        let mounted = true;

        fetch("./data/catalog.json")
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Daftar JSR gagal dimuat.");
                }

                return response.text();
            })
            .then((rawText) => {
                if (!mounted) {
                    return;
                }

                const data = parseJsonSafely(rawText);
                if (!Array.isArray(data)) {
                    throw new Error("Format katalog bukan JSON yang valid.");
                }

                setCatalog(data);
                setCatalogStatus("success");
            })
            .catch(() => {
                if (!mounted) {
                    return;
                }

                setCatalogStatus("error");
            });

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        const onHashChange = () => {
            startTransition(() => {
                setActiveSlug(readHashSlug());
            });
        };

        window.addEventListener("hashchange", onHashChange);
        return () => window.removeEventListener("hashchange", onHashChange);
    }, []);

    useEffect(() => {
        if (!activeSlug) {
            setDetailState({ status: "idle", data: null, error: "" });
            return undefined;
        }

        const controller = new AbortController();

        setDetailState({ status: "loading", data: null, error: "" });

        const currentCatalogItem = catalog.find((item) => item.slug === activeSlug);

        fetch(`./data/jsr/${activeSlug}.json`, { signal: controller.signal })
            .then((response) => {
                if (!response.ok) {
                    if (response.status === 404 && currentCatalogItem) {
                        return buildFallbackDetail(currentCatalogItem);
                    }

                    throw new Error("Catatan JSR tidak ditemukan.");
                }

                return response.text();
            })
            .then((payload) => {
                const data = typeof payload === "string" ? parseJsonSafely(payload) : payload;

                if (!data && currentCatalogItem) {
                    setDetailState({ status: "success", data: buildFallbackDetail(currentCatalogItem), error: "" });
                    return;
                }

                if (!data) {
                    throw new Error("Format detail resep bukan JSON yang valid.");
                }

                setDetailState({ status: "success", data, error: "" });
            })
            .catch((error) => {
                if (error.name === "AbortError") {
                    return;
                }

                setDetailState({ status: "error", data: null, error: error.message });
            });

        return () => controller.abort();
    }, [activeSlug, catalog]);

    useEffect(() => {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
    }, [bookmarks]);

    const bookmarkCount = useMemo(() => Object.keys(bookmarks).length, [bookmarks]);

    const filteredCatalog = useMemo(() => {
        const normalizedQuery = deferredQuery.trim().toLowerCase();

        const matchingItems = !normalizedQuery
            ? catalog
            : catalog.filter((item) => {
                const haystack = [item.title, item.focus, item.tagline, ...(item.tags ?? [])]
                    .join(" ")
                    .toLowerCase();

                return haystack.includes(normalizedQuery);
            });

        return [...matchingItems].sort((a, b) => {
            const aMarked = bookmarks[a.slug] ? 1 : 0;
            const bMarked = bookmarks[b.slug] ? 1 : 0;
            return bMarked - aMarked;
        });
    }, [catalog, deferredQuery, bookmarks]);

    function openNote(slug) {
        window.location.hash = `#/jsr/${slug}`;
    }

    function closePanel() {
        const url = new URL(window.location.href);
        url.hash = "";
        window.history.pushState({}, "", url);
        setActiveSlug("");
    }

    function toggleBookmark(slug) {
        setBookmarks((current) => {
            if (current[slug]) {
                const next = { ...current };
                delete next[slug];
                return next;
            }

            return {
                ...current,
                [slug]: true,
            };
        });
    }

    return (
        <div className="app-shell">
            <main className="page-frame">
                <section className="hero-panel">
                    <div>
                        <span className="eyebrow">Koleksi Catatan Kesehatan</span>
                        <h1>Jurus Sehat Rasulullah</h1>
                        <p>
                            Konsepnya sama seperti aplikasi dzikir, tetapi fokus ke kumpulan catatan bahan kesehatan,
                            resep minuman herbal, dan manfaat yang bisa berpengaruh ke kebugaran harian.
                        </p>
                    </div>

                    <div className="hero-stats">
                        <article>
                            <strong>{catalog.length}</strong>
                            <span>Total catatan JSR</span>
                        </article>
                        <article>
                            <strong>{bookmarkCount}</strong>
                            <span>Catatan dibookmark</span>
                        </article>
                    </div>
                </section>

                <section className="content-grid">
                    <div className="catalog-panel">
                        <div className="section-head">
                            <div>
                                <span className="eyebrow">Halaman Utama</span>
                                <h2>Daftar catatan JSR</h2>
                            </div>
                            <label className="search-box" htmlFor="search-jsr">
                                <span>Cari catatan</span>
                                <input
                                    id="search-jsr"
                                    type="search"
                                    placeholder="kunyit, imun, pencernaan..."
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                />
                            </label>
                        </div>

                        {catalogStatus === "loading" ? <div className="empty-state">Memuat daftar JSR...</div> : null}
                        {catalogStatus === "error" ? (
                            <div className="empty-state">Data katalog gagal dimuat. Periksa file JSON di folder public/data.</div>
                        ) : null}

                        {catalogStatus === "success" ? (
                            filteredCatalog.length ? (
                                <div className="catalog-grid">
                                    {filteredCatalog.map((item) => {
                                        const isBookmarked = Boolean(bookmarks[item.slug]);

                                        return (
                                            <article key={item.slug} className={`note-card ${isBookmarked ? "note-card--bookmarked" : ""}`}>
                                                <div className="note-card__top">
                                                    <span className="chip">{item.focus}</span>
                                                    <button
                                                        className={`bookmark-toggle ${isBookmarked ? "bookmark-toggle--active" : ""}`}
                                                        onClick={() => toggleBookmark(item.slug)}
                                                        aria-label={isBookmarked ? "Hapus bookmark" : "Simpan bookmark"}
                                                    >
                                                        {isBookmarked ? "Bookmarked" : "Bookmark"}
                                                    </button>
                                                </div>
                                                <h3>{item.title}</h3>
                                                <p>{item.tagline}</p>
                                                <div className="tag-row">
                                                    {item.tags.map((tag) => (
                                                        <span key={tag} className="tag-row__item">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                                <button className="card-action" onClick={() => openNote(item.slug)}>
                                                    Buka catatan
                                                </button>
                                            </article>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="empty-state">Tidak ada catatan yang cocok dengan pencarian Anda.</div>
                            )
                        ) : null}
                    </div>

                    <aside className="detail-panel">
                        {!activeSlug ? (
                            <div className="detail-placeholder">
                                <span className="eyebrow">AJAX Panel</span>
                                <h2>Pilih salah satu catatan JSR</h2>
                                <p>
                                    Detail catatan akan dimuat dari JSON secara asynchronous. Klik salah satu kartu pada daftar
                                    untuk melihat bahan, cara membuat, manfaat, lalu simpan sebagai bookmark jika ingin.
                                </p>
                            </div>
                        ) : null}

                        {detailState.status === "loading" ? (
                            <div className="detail-loading">
                                <div className="loading-line loading-line--title" />
                                <div className="loading-line" />
                                <div className="loading-line" />
                                <div className="loading-card" />
                                <div className="loading-card" />
                            </div>
                        ) : null}

                        {detailState.status === "error" ? (
                            <div className="detail-placeholder">
                                <span className="eyebrow">Gagal Memuat</span>
                                <h2>{detailState.error}</h2>
                                <button className="card-action" onClick={closePanel}>
                                    Kembali ke daftar
                                </button>
                            </div>
                        ) : null}

                        {detailState.status === "success" ? (
                            <article className="detail-content">
                                <div className="detail-head">
                                    <h2>{detailState.data.title}</h2>
                                    <div className="detail-actions">
                                        <button
                                            className={`bookmark-toggle ${bookmarks[detailState.data.slug] ? "bookmark-toggle--active" : ""}`}
                                            onClick={() => toggleBookmark(detailState.data.slug)}
                                        >
                                            {bookmarks[detailState.data.slug] ? "Bookmarked" : "Bookmark"}
                                        </button>
                                        <button className="close-button" onClick={closePanel} aria-label="Tutup panel">
                                            Tutup
                                        </button>
                                    </div>
                                </div>

                                <p className="detail-description">{detailState.data.description}</p>

                                <section className="detail-section">
                                    <h3>Bahan</h3>
                                    <ol>
                                        {detailState.data.bahan.map((item) => (
                                            <li key={item}>{item}</li>
                                        ))}
                                    </ol>
                                </section>

                                <section className="detail-section">
                                    <h3>Cara membuat :</h3>
                                    <ol>
                                        {detailState.data.caraMembuat.map((step) => (
                                            <li key={step}>{step}</li>
                                        ))}
                                    </ol>
                                </section>

                                <section className="detail-section">
                                    <h3>Manfaatnya :</h3>
                                    <ol>
                                        {detailState.data.manfaat.map((benefit) => (
                                            <li key={benefit}>{benefit}</li>
                                        ))}
                                    </ol>
                                </section>
                            </article>
                        ) : null}
                    </aside>
                </section>
            </main>
        </div>
    );
}

export default App;
