import { useEffect, useState, type DragEvent } from "react";

import {

  BarChart,

  Bar,

  XAxis,

  YAxis,

  Tooltip,

  ResponsiveContainer,

  CartesianGrid,

} from "recharts";

import {

  apiBlob,

  apiJson,

  base64ToBlob,

  checkHealth,

  MAX_UPLOAD_BYTES,
  createExperiment,
getExperiments,
deleteExperiment,
type Experiment,

  type ComparisonItem,

  type Metrics,

  type ProcessResponse,

  type RobustnessResult,

} from "./api";

import Login from "./pages/Login";
import Register from "./pages/Register";
import {
  getUser,
  isAuthenticated,
  logout,
  type AuthUser,
} from "./services/auth";

import "./App.css";



const DEFAULT_ATTACKS = [

  "jpeg",

  "gaussian_noise",

  "salt_pepper",

  "gaussian_blur",

  "median_blur",

  "resize",

  "crop",

  "rotation",

  "brightness",

  "contrast",

];



const attackLabel = (name: string) =>

  name

    .split("_")

    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))

    .join(" ");



type MessageKind = "success" | "error";



function App() {

  // ==========================================================
  // AUTHENTICATION
  // ==========================================================

  const [authenticated, setAuthenticated] = useState<boolean>(
    () => isAuthenticated()
  );

  const [authScreen, setAuthScreen] = useState<"login" | "register">(
    "login"
  );

  const [authUser, setAuthUser] = useState<AuthUser | null>(
    () => getUser()
  );

  const [originalFile, setOriginalFile] = useState<File | null>(null);

  const [watermarkFile, setWatermarkFile] = useState<File | null>(null);



  const [originalPreview, setOriginalPreview] = useState<string | null>(null);

  const [watermarkPreview, setWatermarkPreview] = useState<string | null>(

    null

  );



  const [watermarkedBlob, setWatermarkedBlob] = useState<Blob | null>(null);

  const [watermarkedImage, setWatermarkedImage] = useState<string | null>(

    null

  );



  const [extractedBlob, setExtractedBlob] = useState<Blob | null>(null);

  const [extractedImage, setExtractedImage] = useState<string | null>(null);



  const [strength, setStrength] = useState(0.05);

  const [secretKey, setSecretKey] = useState("");



  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [experimentHistory, setExperimentHistory] = useState<
  Experiment[]
>([]);

const [historyLoading, setHistoryLoading] =
  useState(false);

  const [comparison, setComparison] = useState<

    Record<string, ComparisonItem> | null

  >(null);



  const [robustnessResults, setRobustnessResults] = useState<

    RobustnessResult[]

  >([]);



  const [loading, setLoading] = useState(false);

  const [extractLoading, setExtractLoading] = useState(false);

  const [comparisonLoading, setComparisonLoading] = useState(false);

  const [robustnessLoading, setRobustnessLoading] = useState(false);

  const [message, setMessage] = useState("");

  const [messageKind, setMessageKind] = useState<MessageKind>("success");

  const [activeNav, setActiveNav] = useState("studio");

  const [apiOnline, setApiOnline] = useState(false);

  const [showSecretKey, setShowSecretKey] = useState(false);

  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);

  const [attackNames, setAttackNames] = useState<string[]>(DEFAULT_ATTACKS);

  const [dragTarget, setDragTarget] = useState<"original" | "watermark" | null>(

    null

  );



  const notify = (text: string, kind: MessageKind) => {

    setMessage(text);

    setMessageKind(kind);

  };



  // ==========================================================
  // AUTH HANDLERS
  // ==========================================================

  const handleAuthSuccess = () => {
    setAuthUser(getUser());
    setAuthenticated(true);
  };

  const handleLogout = () => {
    logout();

    setAccountMenuOpen(false);
    setAccountSettingsOpen(false);
    setAuthenticated(false);
    setAuthUser(null);
    setAuthScreen("login");

    // Clear the current workspace when logging out.
    setOriginalFile(null);
    setWatermarkFile(null);
    setWatermarkedBlob(null);
    setExtractedBlob(null);
    setMetrics(null);
    setComparison(null);
    setRobustnessResults([]);
  };

  const accountInitials = authUser
    ? authUser.name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("")
    : "U";

  const openAccountSettings = () => {
    setAccountMenuOpen(false);
    setAccountSettingsOpen(true);
  };

  /* ----------------------------------------------------------

     IMAGE PREVIEWS

  ---------------------------------------------------------- */



  useEffect(() => {

    if (!originalFile) {

      setOriginalPreview(null);

      return;

    }



    const url = URL.createObjectURL(originalFile);

    setOriginalPreview(url);



    return () => URL.revokeObjectURL(url);

  }, [originalFile]);



  useEffect(() => {

    if (!watermarkFile) {

      setWatermarkPreview(null);

      return;

    }



    const url = URL.createObjectURL(watermarkFile);

    setWatermarkPreview(url);



    return () => URL.revokeObjectURL(url);

  }, [watermarkFile]);



  useEffect(() => {

    if (!watermarkedBlob) {

      setWatermarkedImage(null);

      return;

    }



    const url = URL.createObjectURL(watermarkedBlob);

    setWatermarkedImage(url);



    return () => URL.revokeObjectURL(url);

  }, [watermarkedBlob]);



  useEffect(() => {

    if (!extractedBlob) {

      setExtractedImage(null);

      return;

    }



    const url = URL.createObjectURL(extractedBlob);

    setExtractedImage(url);



    return () => URL.revokeObjectURL(url);

  }, [extractedBlob]);



  useEffect(() => {

    setWatermarkedBlob(null);

    setExtractedBlob(null);

    setMetrics(null);

    setComparison(null);

    setRobustnessResults([]);

  }, [originalFile, watermarkFile]);



 useEffect(() => {
  if (!authenticated) return;

  let mounted = true;

  const loadExperimentHistory = async () => {
    setHistoryLoading(true);

    try {
      const data = await getExperiments();

      if (mounted) {
        setExperimentHistory(data);
      }
    } catch {
      if (mounted) {
        setExperimentHistory([]);
      }
    } finally {
      if (mounted) {
        setHistoryLoading(false);
      }
    }
  };

    loadExperimentHistory();

  return () => {
    mounted = false;
  };
}, [authenticated]);

  useEffect(() => {
    let mounted = true;

    const ping = async () => {
      const online = await checkHealth();

      if (mounted) {
        setApiOnline(online);
      }
    };

    ping();

    const timer = window.setInterval(ping, 8000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    apiJson<{ attacks: string[] }>("/attacks")
      .then((data) => {
        if (mounted && data.attacks?.length) {
          setAttackNames(data.attacks);
        }
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);



  useEffect(() => {

    let mounted = true;



    apiJson<{ attacks: string[] }>("/attacks")

      .then((data) => {

        if (mounted && data.attacks?.length) {

          setAttackNames(data.attacks);

        }

      })

      .catch(() => undefined);



    return () => {

      mounted = false;

    };

  }, []);



  /* ----------------------------------------------------------

     NAVIGATION

  ---------------------------------------------------------- */



  const navigateTo = (id: string) => {

    setActiveNav(id);



    const element = document.getElementById(id);



    if (element) {

      element.scrollIntoView({

        behavior: "smooth",

        block: "start",

      });

    }

  };



  const acceptImage = (

    file: File | undefined | null,

    target: "original" | "watermark"

  ) => {

    if (!file) return;



    if (!file.type.startsWith("image/")) {

      notify("Please choose an image file.", "error");

      return;

    }



    if (file.size > MAX_UPLOAD_BYTES) {

      notify("Uploaded file is too large (max 20 MB).", "error");

      return;

    }



    if (target === "original") {

      setOriginalFile(file);

    } else {

      setWatermarkFile(file);

    }

  };



  const resetWorkspace = () => {

    setOriginalFile(null);

    setWatermarkFile(null);

    setWatermarkedBlob(null);

    setExtractedBlob(null);

    setMetrics(null);

    setComparison(null);

    setRobustnessResults([]);

    notify("Workspace cleared.", "success");

  };



  const handleDrop = (

    event: DragEvent<HTMLLabelElement>,

    target: "original" | "watermark"

  ) => {

    event.preventDefault();

    setDragTarget(null);

    acceptImage(event.dataTransfer.files?.[0], target);

  };



  /* ----------------------------------------------------------

     EMBED WATERMARK

  ---------------------------------------------------------- */



  const handleEmbed = async () => {

    if (!originalFile || !watermarkFile) {

      notify("Please select both the original image and watermark.", "error");

      return;

    }



    if (!secretKey.trim()) {

      notify("Please enter a secret key.", "error");

      return;

    }



    setLoading(true);

    setMessage("");

    setMetrics(null);



    try {

      const formData = new FormData();



    formData.append("image", originalFile);
      formData.append("watermark", watermarkFile);

      formData.append("alpha", strength.toString());

      formData.append("secret_key", secretKey);



      const data = await apiJson<ProcessResponse>("/watermark/process", {

        method: "POST",

        body: formData,

      });



      setWatermarkedBlob(base64ToBlob(data.watermarked_image));

      setExtractedBlob(base64ToBlob(data.extracted_watermark));

      setMetrics(data.metrics);

      notify(

        data.color_preserved

          ? "Watermark embedded in the luminance channel. Color preserved."

          : "Watermark embedded successfully.",

        "success"

      );

    } catch (error) {

      notify(

        error instanceof Error ? error.message : "Something went wrong.",

        "error"

      );

    } finally {

      setLoading(false);

    }

  };



  const handleExtract = async () => {

    if (!originalFile || !watermarkedBlob) {

      notify("Upload an original image and embed or load a watermarked image first.", "error");

      return;

    }



    if (!secretKey.trim()) {

      notify("Please enter a secret key.", "error");

      return;

    }



    setExtractLoading(true);

    setMessage("");



    try {

      const formData = new FormData();

      formData.append("original_image", originalFile);

      formData.append("watermarked_image", watermarkedBlob, "watermarked.png");

      formData.append("alpha", strength.toString());

      formData.append("secret_key", secretKey);



      const extracted = await apiBlob("/watermark/extract", {

        method: "POST",

        body: formData,

      });



      setExtractedBlob(extracted);

      notify("Watermark extracted.", "success");

    } catch (error) {

      notify(

        error instanceof Error ? error.message : "Extraction failed.",

        "error"

      );

    } finally {

      setExtractLoading(false);

    }

  };



  /* ----------------------------------------------------------

     COMPARISON

  ---------------------------------------------------------- */
const handleComparison = async () => {
  if (!originalFile || !watermarkFile) {
    notify("Select both images before comparison.", "error");
    return;
  }

  if (!secretKey.trim()) {
    notify("Enter a secret key before comparison.", "error");
    return;
  }

  setComparisonLoading(true);
  setMessage("");

  try {
    const formData = new FormData();

    // These names MUST match FastAPI
    formData.append("original_image", originalFile);
    formData.append("original_watermark", watermarkFile);
    formData.append("alpha", strength.toString());
    formData.append("secret_key", secretKey);

    const data = await apiJson<{
      alpha: number;
      comparison: Record<string, ComparisonItem>;
    }>("/comparison/test", {
      method: "POST",
      body: formData,
    });

    // Backend returns "comparison"
    setComparison(data.comparison);

    // ---------------------------------------------
    // SAVE HYBRID RESULT TO EXPERIMENT HISTORY
    // ---------------------------------------------

    try {
      const hybrid = data.comparison["Hybrid"];

      if (!hybrid) {
        throw new Error(
          "Hybrid result was not returned by the backend."
        );
      }

      const savedExperiment = await createExperiment({
        algorithm: "Hybrid",
        alpha: data.alpha,
        psnr: hybrid.PSNR_dB,
        ssim: hybrid.SSIM,
        nc: hybrid.NC,
        ber: hybrid.BER,
      });

      setExperimentHistory((current) => [
        savedExperiment,
        ...current,
      ]);

      notify(
        "Algorithm comparison completed and saved to history.",
        "success"
      );
    } catch (historyError) {
      console.error(
        "Experiment history save failed:",
        historyError
      );

      notify(
        historyError instanceof Error
          ? `Comparison completed, but history save failed: ${historyError.message}`
          : "Comparison completed, but history save failed.",
        "error"
      );
    }
  } catch (error) {
    console.error("Comparison failed:", error);

    notify(
      error instanceof Error
        ? error.message
        : "Algorithm comparison failed.",
      "error"
    );
  } finally {
    setComparisonLoading(false);
  }
};
  /* ----------------------------------------------------------

     ROBUSTNESS

  ---------------------------------------------------------- */



  const handleRobustnessTest = async () => {

    if (!originalFile || !watermarkFile || !watermarkedBlob) {

      notify("Embed a watermark before running robustness tests.", "error");

      return;

    }



    if (!secretKey.trim()) {

      notify("Enter a secret key before robustness testing.", "error");

      return;

    }



    setRobustnessLoading(true);

    setMessage("");



    try {

      const formData = new FormData();



      formData.append("original_image", originalFile);

      formData.append(

        "watermarked_image",

        watermarkedBlob,

        "watermarked.png"

      );

      formData.append("original_watermark", watermarkFile);

      formData.append("alpha", strength.toString());

      formData.append("secret_key", secretKey);



      const data = await apiJson<{ results: RobustnessResult[] }>(

        "/robustness/test",

        {

          method: "POST",

          body: formData,

        }

      );



      setRobustnessResults( data.results|| []);



      notify(
        `${data.results?.length ?? 0} robustness attacks completed.`,
        "success"
      );

    } catch (error) {

      notify(

        error instanceof Error

          ? error.message

          : "Robustness testing failed.",

        "error"

      );

    } finally {

      setRobustnessLoading(false);

    }

  };

  /* ----------------------------------------------------------

     DOWNLOAD

  ---------------------------------------------------------- */



  const downloadBlob = (
    blob: Blob | null,
    filename: string
  ) => {

    if (!blob) return;



    const url = URL.createObjectURL(blob);



    const link = document.createElement("a");

    link.href = url;

    link.download = filename;

    link.click();



    URL.revokeObjectURL(url);

  };



  /* ----------------------------------------------------------

     CHART DATA

  ---------------------------------------------------------- */



  const comparisonChartData = comparison

    ? Object.entries(comparison).map(([algorithm, values]) => ({

        algorithm,

        PSNR: Number(values.PSNR_dB.toFixed(2)),

        SSIM: Number(values.SSIM.toFixed(4)),

        NC: Number(values.NC.toFixed(4)),

        BER: Number(values.BER.toFixed(4)),

      }))

    : [];



  const robustnessChartData = robustnessResults.map(

    (item) => ({

      attack: attackLabel(item.attack),

      NC: Number(item.NC.toFixed(3)),

      SSIM: Number(item.SSIM.toFixed(3)),

    })

  );



  const bestAlgorithm = comparison

    ? Object.entries(comparison).sort((left, right) => {

        if (right[1].NC !== left[1].NC) {

          return right[1].NC - left[1].NC;

        }

        return right[1].PSNR_dB - left[1].PSNR_dB;

      })[0][0]

    : null;



  const pipelineStage = robustnessResults.length

    ? 4

    : metrics

      ? 3

      : watermarkedBlob

        ? 2

        : originalFile && watermarkFile

          ? 1

          : 0;



  const pipelineClass = (step: number) =>

    pipelineStage >= step ? "pipeline-step active" : "pipeline-step";

  // ==========================================================
  // AUTHENTICATION SCREEN
  // ==========================================================

  if (!authenticated) {
    if (authScreen === "register") {
      return (
        <Register
          onRegisterSuccess={handleAuthSuccess}
          onLoginClick={() => setAuthScreen("login")}
        />
      );
    }

    return (
      <Login
        onLoginSuccess={handleAuthSuccess}
        onRegisterClick={() => setAuthScreen("register")}
      />
    );
  }



  return (

    <div className="app-shell">



      {/* =====================================================

          SIDEBAR

      ===================================================== */}



      <aside className="sidebar">



        <div className="brand">

          <div className="brand-mark">W</div>



          <div>

            <div className="brand-name">Watermark</div>

            <div className="brand-subtitle">Research Lab</div>

          </div>

        </div>



        <div className="sidebar-label">

          WORKSPACE

        </div>



        <nav className="sidebar-nav">



          <button

            className={activeNav === "studio" ? "nav-item active" : "nav-item"}

            onClick={() => navigateTo("studio")}

          >

            <span>◈</span>

            <span>Watermark Studio</span>

          </button>



          <button

            className={

              activeNav === "quality"

                ? "nav-item active"

                : "nav-item"

            }

            onClick={() => navigateTo("quality")}

          >

            <span>◌</span>

            <span>Quality Analysis</span>

          </button>



          <button

            className={

              activeNav === "comparison"

                ? "nav-item active"

                : "nav-item"

            }

            onClick={() => navigateTo("comparison")}

          >

            <span>▦</span>

            <span>Algorithm Lab</span>

          </button>



          <button

            className={

              activeNav === "robustness"

                ? "nav-item active"

                : "nav-item"

            }

            onClick={() => navigateTo("robustness")}

          >

            <span>⌁</span>

            <span>Robustness Lab</span>

          </button>
                    <button
            className={
              activeNav === "history"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => navigateTo("history")}
          >
            <span>◷</span>
            <span>Experiment History</span>
          </button>



        </nav>



        <div className="sidebar-divider" />



        <div className="sidebar-label">

          ALGORITHMS

        </div>



        <div className="algorithm-list">

          <div>

            <span className="algo-dot blue" />

            DCT

          </div>



          <div>

            <span className="algo-dot cyan" />

            DWT

          </div>



          <div>

            <span className="algo-dot violet" />

            Hybrid DCT-DWT

          </div>

        </div>



        <div className="sidebar-bottom">

          {authUser && (
            <div className="account-area">
              <button
                type="button"
                className={
                  accountMenuOpen
                    ? "account-card account-card-open"
                    : "account-card"
                }
                onClick={() => setAccountMenuOpen((value) => !value)}
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
              >
                <span className="account-avatar">{accountInitials}</span>

                <span className="account-card-info">
                  <strong>{authUser.name}</strong>
                  <span>{authUser.email}</span>
                </span>

                <span className="account-chevron">
                  {accountMenuOpen ? "⌃" : "⌄"}
                </span>
              </button>

              {accountMenuOpen && (
                <div className="account-menu" role="menu">
                  <div className="account-menu-header">
                    <span className="account-avatar account-avatar-large">
                      {accountInitials}
                    </span>
                    <div>
                      <strong>{authUser.name}</strong>
                      <span>Signed in</span>
                    </div>
                  </div>

                  <div className="account-menu-divider" />

                  <button
                    type="button"
                    className="account-menu-item"
                    onClick={openAccountSettings}
                    role="menuitem"
                  >
                    <span className="account-menu-icon">⚙</span>
                    <span>
                      <strong>Account Settings</strong>
                      <small>Profile and session</small>
                    </span>
                  </button>

                  <button
                    type="button"
                    className="account-menu-item account-menu-logout"
                    onClick={handleLogout}
                    role="menuitem"
                  >
                    <span className="account-menu-icon">↪</span>
                    <span>
                      <strong>Log out</strong>
                      <small>End your current session</small>
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="api-status">

            <span className={apiOnline ? "status-dot" : "status-dot offline"} />



            <div>

              <strong>{apiOnline ? "Local API" : "API Offline"}</strong>

              <small>FastAPI :8000</small>

            </div>

          </div>



          <div className="version">

            Hybrid Watermarking v1.2

          </div>



        </div>



      </aside>



      {/* =====================================================

          MAIN

      ===================================================== */}



      <main className="main-content">



        {/* TOP BAR */}



        <header className="topbar">



          <div>

            <div className="breadcrumb">

              WORKSPACE / WATERMARK LAB

            </div>



            <h1>Image Watermarking Dashboard</h1>

          </div>



          <div className="topbar-actions">

            <div className="topbar-status">

              <span className={apiOnline ? "status-dot" : "status-dot offline"} />

              {apiOnline ? "Local Processing" : "Backend Unreachable"}

            </div>



            <button

              type="button"

              className="ghost-button"

              onClick={resetWorkspace}

            >

              Reset

            </button>

          </div>



        </header>



        {/* =================================================

            HERO

        ================================================= */}



        <section className="hero">



          <div className="hero-content">



            <div className="hero-badge">

              HYBRID DCT + DWT

            </div>



            <h2>

              Secure image watermarking,

              <br />

              <span>built for experimentation.</span>

            </h2>



            <p>

              Embed, extract and evaluate invisible watermarks

              using transform-domain techniques with secret-key

              protection and robustness testing.

            </p>



            <div className="hero-pipeline">



              <div className={pipelineClass(1)}>

                <span>01</span>

                Upload

              </div>



              <div className="pipeline-line" />



              <div className={pipelineClass(2)}>

                <span>02</span>

                Embed

              </div>



              <div className="pipeline-line" />



              <div className={pipelineClass(3)}>

                <span>03</span>

                Analyze

              </div>



              <div className="pipeline-line" />



              <div className={pipelineClass(4)}>

                <span>04</span>

                Attack Test

              </div>



            </div>



          </div>



          <div className="hero-visual">



            <div className="orb orb-one" />

            <div className="orb orb-two" />



            <div className="visual-card">



              <div className="visual-card-header">

                <span>TRANSFORM DOMAIN</span>

                <span>ACTIVE</span>

              </div>



              <div className="waveform">

                <div />

                <div />

                <div />

                <div />

                <div />

                <div />

                <div />

                <div />

                <div />

                <div />

              </div>



              <div className="visual-equation">

                DWT <span>→</span> DCT <span>→</span> EMBED

              </div>



            </div>



          </div>



        </section>



        {/* =================================================

            STUDIO

        ================================================= */}



        <section id="studio" className="dashboard-section">



          <div className="section-heading">



            <div>

              <span className="section-number">01</span>



              <div>

                <h2>Watermark Studio</h2>



                <p>

                  Prepare your carrier image and secret watermark.

                </p>

              </div>

            </div>



            <div className="section-tag">

              EMBEDDING

            </div>



          </div>



          {/* UPLOAD WORKSPACE */}



          <div className="upload-grid">



            {/* ORIGINAL */}



            <div className="upload-panel">



              <div className="panel-top">



                <div>

                  <span className="panel-number">

                    INPUT 01

                  </span>



                  <h3>Original Image</h3>



                  <p>

                    Host image for watermark embedding

                  </p>

                </div>



                <span className="file-type">

                  JPG / PNG

                </span>



              </div>



              <label

                className={

                  dragTarget === "original"

                    ? "drop-zone drag-over"

                    : "drop-zone"

                }

                onDragOver={(event) => {

                  event.preventDefault();

                  setDragTarget("original");

                }}

                onDragLeave={() => setDragTarget(null)}

                onDrop={(event) => handleDrop(event, "original")}

              >



                {originalPreview ? (

                  <img

                    src={originalPreview}

                    className="preview-image"

                    alt="Original"

                  />

                ) : (

                  <>

                    <div className="upload-icon">

                      +

                    </div>



                    <strong>

                      Drop your image here

                    </strong>



                    <span>

                      or click to browse files

                    </span>

                  </>

                )}



                <input

                  type="file"

                  accept="image/*"

                  onChange={(e) =>

                    acceptImage(e.target.files?.[0], "original")

                  }

                />



              </label>



              {originalFile && (

                <div className="selected-file">

                  <span>✓</span>

                  {originalFile.name}

                </div>

              )}



            </div>



            {/* WATERMARK */}



            <div className="upload-panel">



              <div className="panel-top">



                <div>

                  <span className="panel-number">

                    INPUT 02

                  </span>



                  <h3>Watermark</h3>



                  <p>

                    Secret image to be embedded

                  </p>

                </div>



                <span className="file-type">

                  JPG / PNG

                </span>



              </div>



              <label

                className={

                  dragTarget === "watermark"

                    ? "drop-zone watermark-zone drag-over"

                    : "drop-zone watermark-zone"

                }

                onDragOver={(event) => {

                  event.preventDefault();

                  setDragTarget("watermark");

                }}

                onDragLeave={() => setDragTarget(null)}

                onDrop={(event) => handleDrop(event, "watermark")}

              >



                {watermarkPreview ? (

                  <img

                    src={watermarkPreview}

                    className="preview-image watermark-preview"

                    alt="Watermark"

                  />

                ) : (

                  <>

                    <div className="upload-icon">

                      +

                    </div>



                    <strong>

                      Drop watermark here

                    </strong>



                    <span>

                      or click to browse files

                    </span>

                  </>

                )}



                <input

                  type="file"

                  accept="image/*"

                  onChange={(e) =>

                    acceptImage(e.target.files?.[0], "watermark")

                  }

                />



              </label>



              {watermarkFile && (

                <div className="selected-file">

                  <span>✓</span>

                  {watermarkFile.name}

                </div>

              )}



            </div>



          </div>



          {/* CONFIGURATION */}



          <div className="configuration-panel">



            <div className="configuration-header">



              <div>

                <span className="panel-number">

                  CONFIGURATION

                </span>



                <h3>Embedding Parameters</h3>

              </div>



              <div className="security-badge">

                🔐 KEY PROTECTED

              </div>



            </div>



            <div className="configuration-grid">



              <div className="control-group">



                <label>

                  Secret Key

                </label>



                <div className="input-wrapper">



                  <span>⌘</span>



                  <input

                    type={showSecretKey ? "text" : "password"}

                    value={secretKey}

                    onChange={(e) =>

                      setSecretKey(e.target.value)

                    }

                    placeholder="Enter secure secret key"

                  />



                  <button

                    type="button"

                    className="key-toggle"

                    onClick={() => setShowSecretKey((value) => !value)}

                  >

                    {showSecretKey ? "Hide" : "Show"}

                  </button>



                </div>



                <small>

                  Used to scramble and recover the watermark.

                </small>



              </div>



              <div className="control-group">



                <div className="slider-label">



                  <label>

                    Embedding Strength

                  </label>



                  <strong>

                    {strength.toFixed(3)}

                  </strong>



                </div>



                <input

                  className="strength-slider"

                  type="range"

                  min="0.01"

                  max="0.2"

                  step="0.01"

                  value={strength}

                  onChange={(e) =>

                    setStrength(Number(e.target.value))

                  }

                />



                <div className="slider-range">

                  <span>0.01</span>

                  <span>0.20</span>

                </div>



              </div>



            </div>



            <div className="action-row">

              <button

                className="primary-button"

                onClick={handleEmbed}

                disabled={loading || extractLoading}

              >



                <span>

                  {loading

                    ? "Processing..."

                    : "✦ Embed Watermark"}

                </span>



                <span>→</span>



              </button>



              <button

                type="button"

                className="outline-button extract-button"

                onClick={handleExtract}

                disabled={extractLoading || loading || !watermarkedBlob}

              >

                {extractLoading ? "Extracting..." : "Extract Watermark"}

              </button>

            </div>



          </div>



          {message && (

            <div

              className={

                messageKind === "error"

                  ? "message error"

                  : "message success"

              }

              role={messageKind === "error" ? "alert" : "status"}

            >

              <span>

                {messageKind === "error" ? "!" : "✓"}

              </span>



              {message}

            </div>

          )}



        </section>



        {/* =================================================

            RESULT

        ================================================= */}



        {watermarkedImage && (

          <section className="result-section">



            <div className="section-heading">



              <div>

                <span className="section-number">

                  OUTPUT

                </span>



                <div>

                  <h2>Watermark Result</h2>



                  <p>

                    Your protected image has been generated.

                  </p>

                </div>

              </div>



              <div className="success-pill">

                ✓ GENERATED

              </div>



            </div>



            <div className="result-grid">



              <div className="result-image-card">



                <div className="result-image-header">

                  <span>WATERMARKED IMAGE</span>



                  <span>

                    HYBRID DCT-DWT

                  </span>

                </div>



                <div className="large-image-container">



                  <img

                    src={watermarkedImage}

                    alt="Watermarked"

                  />



                </div>



                <button

                  className="download-button"

                  onClick={() =>

                    downloadBlob(

                      watermarkedBlob,

                      "watermarked.png"

                    )

                  }

                >

                  ↓ Download Watermarked Image

                </button>



              </div>



              {extractedImage && (

                <div className="result-image-card">



                  <div className="result-image-header">

                    <span>EXTRACTED WATERMARK</span>



                    <span>

                      VERIFIED

                    </span>

                  </div>



                  <div className="large-image-container extracted">



                    <img

                      src={extractedImage}

                      alt="Extracted watermark"

                    />



                  </div>



                  <button

                    className="download-button secondary"

                    onClick={() =>

                      downloadBlob(

                        extractedBlob,

                        "extracted-watermark.png"

                      )

                    }

                  >

                    ↓ Download Extracted Watermark

                  </button>



                </div>

              )}



            </div>



          </section>

        )}



        {/* =================================================

            QUALITY

        ================================================= */}



        <section id="quality" className="dashboard-section">



          <div className="section-heading">



            <div>

              <span className="section-number">

                02

              </span>



              <div>

                <h2>Quality Analysis</h2>



                <p>

                  Measure visual quality and watermark recovery.

                </p>

              </div>

            </div>



            <div className="section-tag">

              METRICS

            </div>



          </div>



          {metrics ? (

            <div className="metrics-grid">



              <div className="metric-card blue-accent">

                <span>PSNR</span>



                <strong>

                  {metrics.PSNR_dB.toFixed(2)}

                </strong>



                <small>dB · Image Quality</small>

              </div>



              <div className="metric-card cyan-accent">

                <span>SSIM</span>



                <strong>

                  {metrics.SSIM.toFixed(4)}

                </strong>



                <small>Structural Similarity</small>

              </div>



              <div className="metric-card violet-accent">

                <span>NC</span>



                <strong>

                  {metrics.NC.toFixed(4)}

                </strong>



                <small>Normalized Correlation</small>

              </div>



              <div className="metric-card pink-accent">

                <span>BER</span>



                <strong>

                  {metrics.BER.toFixed(4)}

                </strong>



                <small>Bit Error Rate</small>

              </div>



            </div>

          ) : (

            <div className="empty-state">



              <div className="empty-icon">

                ◌

              </div>



              <h3>No analysis available</h3>



              <p>

                Embed a watermark to generate quality metrics.

              </p>



            </div>

          )}



        </section>



        {/* =================================================

            COMPARISON

        ================================================= */}



        <section

          id="comparison"

          className="dashboard-section"

        >



          <div className="section-heading">



            <div>

              <span className="section-number">

                03

              </span>



              <div>

                <h2>Algorithm Laboratory</h2>



                <p>

                  Compare DCT, DWT and Hybrid performance.

                </p>

              </div>

            </div>



            <button

              className="outline-button"

              onClick={handleComparison}

              disabled={comparisonLoading || loading}

            >

              {comparisonLoading

                ? "Running..."

                : "Run Comparison →"}

            </button>



          </div>



          {comparison ? (

            <>



              <div className="comparison-table-wrapper">



                <table className="comparison-table">



                  <thead>

                    <tr>

                      <th>Algorithm</th>

                      <th>PSNR</th>

                      <th>SSIM</th>

                      <th>NC</th>

                      <th>BER</th>

                    </tr>

                  </thead>



                  <tbody>



                    {Object.entries(comparison).map(

                      ([algorithm, values]) => (

                        <tr

                          key={algorithm}

                          className={

                            algorithm === bestAlgorithm ? "winner-row" : undefined

                          }

                        >



                          <td>

                            <div className="algorithm-name">



                              <span

                                className={`algorithm-marker ${algorithm

                                  .toLowerCase()

                                  .replaceAll(" ", "-")}`}

                              />



                              {algorithm}

                              {algorithm === bestAlgorithm ? (

                                <em className="winner-tag">best NC</em>

                              ) : null}

                            </div>

                          </td>



                          <td>

                            {values.PSNR_dB.toFixed(2)} dB

                          </td>



                          <td>

                            {values.SSIM.toFixed(4)}

                          </td>



                          <td>

                            {values.NC.toFixed(4)}

                          </td>



                          <td>

                            {values.BER.toFixed(4)}

                          </td>



                        </tr>

                      )

                    )}



                  </tbody>



                </table>



              </div>



              <div className="charts-grid">



                <div className="chart-card">



                  <div className="chart-header">

                    <div>

                      <span>VISUAL QUALITY</span>

                      <h3>PSNR Comparison</h3>

                    </div>

                  </div>



                  <ResponsiveContainer width="100%" height={300}>



                    <BarChart data={comparisonChartData}>



                      <CartesianGrid

                        strokeDasharray="3 3"

                        stroke="rgba(255,255,255,0.06)"

                      />



                      <XAxis

                        dataKey="algorithm"

                        stroke="#7d8799"

                      />



                      <YAxis

                        stroke="#7d8799"

                      />



                      <Tooltip

                        contentStyle={{

                          background: "#111827",

                          border:

                            "1px solid rgba(255,255,255,.1)",

                          borderRadius: "10px",

                        }}

                      />



                      <Bar

                        dataKey="PSNR"

                        fill="#4f8cff"

                        radius={[6, 6, 0, 0]}

                      />



                    </BarChart>



                  </ResponsiveContainer>



                </div>



                <div className="chart-card">



                  <div className="chart-header">

                    <div>

                      <span>WATERMARK RECOVERY</span>

                      <h3>NC Comparison</h3>

                    </div>

                  </div>



                  <ResponsiveContainer width="100%" height={300}>



                    <BarChart data={comparisonChartData}>



                      <CartesianGrid

                        strokeDasharray="3 3"

                        stroke="rgba(255,255,255,0.06)"

                      />



                      <XAxis

                        dataKey="algorithm"

                        stroke="#7d8799"

                      />



                      <YAxis

                        stroke="#7d8799"

                      />



                      <Tooltip

                        contentStyle={{

                          background: "#111827",

                          border:

                            "1px solid rgba(255,255,255,.1)",

                          borderRadius: "10px",

                        }}

                      />



                      <Bar

                        dataKey="NC"

                        fill="#8b5cf6"

                        radius={[6, 6, 0, 0]}

                      />



                    </BarChart>



                  </ResponsiveContainer>



                </div>



              </div>



            </>

          ) : (

            <div className="empty-state">



              <div className="empty-icon">

                ▦

              </div>



              <h3>Algorithm comparison</h3>



              <p>

                Run the comparison to evaluate DCT, DWT and

                Hybrid DCT-DWT.

              </p>



              <button

                className="primary-small-button"

                onClick={handleComparison}

                disabled={comparisonLoading || loading}

              >

                {comparisonLoading ? "Running..." : "Run Analysis"}

              </button>



            </div>

          )}



        </section>



        {/* =================================================

            ROBUSTNESS

        ================================================= */}

{/* =================================================
    ROBUSTNESS
================================================= */}

<section
  id="robustness"
  className="dashboard-section"
>
  <div className="section-heading">
    <div>
      <span className="section-number">04</span>

      <div>
        <h2>Robustness Laboratory</h2>

        <p>
          Test watermark survival against image attacks.
        </p>
      </div>
    </div>

    <button
      className="danger-outline-button"
      onClick={handleRobustnessTest}
      disabled={robustnessLoading || !watermarkedBlob}
    >
      {robustnessLoading
        ? "Testing..."
        : `Run ${attackNames.length} Attacks →`}
    </button>
  </div>

  {/* ATTACK CARDS */}
  <div className="attack-grid">
    {attackNames.map((attack, index) => {
      const result = robustnessResults.find(
        (item) => item.attack === attack
      );

      return (
        <div
          className={`attack-card ${
            result ? "attack-card-tested" : ""
          }`}
          key={attack}
        >
          <div className="attack-number">
            {(index + 1)
              .toString()
              .padStart(2, "0")}
          </div>

          <div className="attack-info">
            <strong>{attackLabel(attack)}</strong>

            <span>
              {result
                ? `NC ${result.NC.toFixed(3)}`
                : "Awaiting test"}
            </span>
          </div>

          <div
            className={
              result
                ? "attack-status tested"
                : "attack-status"
            }
          >
            {result ? "✓" : "—"}
          </div>
        </div>
      );
    })}
  </div>

  {/* RESULTS */}
  {robustnessResults.length > 0 && (
    <>
      {/* SUMMARY */}
      <div className="robustness-summary">
        <div className="robustness-stat">
          <span>ATTACKS TESTED</span>

          <strong>
            {robustnessResults.length}
          </strong>

          <small>
            Simulation coverage
          </small>
        </div>

        <div className="robustness-stat">
          <span>AVG. NC</span>

          <strong>
            {(
              robustnessResults.reduce(
                (sum, item) => sum + item.NC,
                0
              ) / robustnessResults.length
            ).toFixed(3)}
          </strong>

          <small>
            Watermark correlation
          </small>
        </div>

        <div className="robustness-stat">
          <span>AVG. SSIM</span>

          <strong>
            {(
              robustnessResults.reduce(
                (sum, item) => sum + item.SSIM,
                0
              ) / robustnessResults.length
            ).toFixed(3)}
          </strong>

          <small>
            Image structural quality
          </small>
        </div>
      </div>

      {/* ROBUSTNESS NOTE */}
      <div className="robustness-note">
        <div className="robustness-note-icon">
          i
        </div>

        <div>
          <strong>
            Experimental robustness analysis
          </strong>

          <p>
            Each attack measures how well the embedded
            watermark survives common image-processing
            distortions. Higher NC indicates stronger
            watermark recovery, while higher SSIM
            indicates better preserved image structure.
          </p>
        </div>
      </div>

      {/* CHARTS */}
      <div className="charts-grid">

        {/* NC CHART */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <span>ROBUSTNESS</span>
              <h3>NC Across Attacks</h3>
            </div>
          </div>

          <ResponsiveContainer
            width="100%"
            height={350}
          >
            <BarChart
              data={robustnessChartData}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
              />

              <XAxis
                dataKey="attack"
                angle={-35}
                textAnchor="end"
                height={90}
                stroke="#7d8799"
              />

              <YAxis
                stroke="#7d8799"
              />

              <Tooltip
                contentStyle={{
                  background: "#111827",
                  border:
                    "1px solid rgba(255,255,255,.1)",
                  borderRadius: "10px",
                }}
              />

              <Bar
                dataKey="NC"
                fill="#22d3ee"
                radius={[5, 5, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* SSIM CHART */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <span>IMAGE QUALITY</span>
              <h3>SSIM Across Attacks</h3>
            </div>
          </div>

          <ResponsiveContainer
            width="100%"
            height={350}
          >
            <BarChart
              data={robustnessChartData}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
              />

              <XAxis
                dataKey="attack"
                angle={-35}
                textAnchor="end"
                height={90}
                stroke="#7d8799"
              />

              <YAxis
                stroke="#7d8799"
              />

              <Tooltip
                contentStyle={{
                  background: "#111827",
                  border:
                    "1px solid rgba(255,255,255,.1)",
                  borderRadius: "10px",
                }}
              />

              <Bar
                dataKey="SSIM"
                fill="#a78bfa"
                radius={[5, 5, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>
    </>
  )}
</section>
        {/* =================================================
            EXPERIMENT HISTORY
        ================================================= */}

       
<section
  id="results"
  className="dashboard-section results-section"
>
  <div className="section-heading">
    <div>
      <span className="section-number">05</span>

      <div>
        <h2>Final Results</h2>
        <p>
          Summary of algorithm performance and experimental findings.
        </p>
      </div>
    </div>
  </div>

  <div className="results-grid">

    <div className="result-highlight">
      <span className="result-label">BEST WATERMARK RECOVERY</span>
      <strong>DWT</strong>

      <div className="result-metric-row">
        <span>NC</span>
        <b>0.7826</b>
      </div>

      <div className="result-metric-row">
        <span>BER</span>
        <b>0.0325</b>
      </div>

      <p>
        DWT achieved the strongest watermark recovery
        among the tested algorithms.
      </p>
    </div>

    <div className="result-highlight">
      <span className="result-label">BEST VISUAL QUALITY</span>
      <strong>Hybrid</strong>

      <div className="result-metric-row">
        <span>PSNR</span>
        <b>38.40 dB</b>
      </div>

      <div className="result-metric-row">
        <span>SSIM</span>
        <b>0.9884</b>
      </div>

      <p>
        Hybrid produced the highest visual-quality scores
        in the algorithm comparison.
      </p>
    </div>

    <div className="result-highlight">
      <span className="result-label">ROBUSTNESS EVALUATION</span>
      <strong>10 Attacks</strong>

      <div className="result-metric-row">
        <span>Average NC</span>
        <b>0.040</b>
      </div>

      <div className="result-metric-row">
        <span>Average SSIM</span>
        <b>0.807</b>
      </div>

      <p>
        The system evaluates watermark survival against
        ten common image-processing attacks.
      </p>
    </div>

  </div>

  <div className="results-conclusion">
    <span className="results-conclusion-label">
      EXPERIMENTAL CONCLUSION
    </span>

    <p>
      The experimental results show a trade-off between
      watermark recovery and visual quality. DWT provided
      the strongest watermark recovery, while Hybrid
      provided the best visual quality. The robustness
      laboratory provides a systematic framework for
      evaluating watermark behavior under image attacks.
    </p>
  </div>
</section>

 <section
          id="history"
          className="dashboard-section"
        >
          <div className="section-heading">
            <div>
              <span className="section-number">
                06
              </span>

              <div>
                <h2>Experiment History</h2>

                <p>
                  Review and manage your previous watermarking experiments.
                </p>
              </div>
            </div>

            <div className="section-tag">
              HISTORY
            </div>
          </div>

          {historyLoading ? (
            <div className="history-empty">
              <span>Loading experiment history...</span>
            </div>
          ) : experimentHistory.length === 0 ? (
            <div className="history-empty">
              <strong>No experiments yet</strong>

              <span>
                Run an algorithm comparison to save your experiment results here.
              </span>
            </div>
          ) : (
            <div className="history-card">
              <div className="history-table-wrapper">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Algorithm</th>
                      <th>Alpha</th>
                      <th>PSNR</th>
                      <th>SSIM</th>
                      <th>NC</th>
                      <th>BER</th>
                      <th>Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {experimentHistory.map((experiment) => (
                      <tr key={experiment.id}>
                        <td>
                          <strong>
                            {experiment.algorithm}
                          </strong>
                        </td>

                        <td>
                          {experiment.alpha.toFixed(2)}
                        </td>

                        <td>
                          {experiment.psnr.toFixed(2)} dB
                        </td>

                        <td>
                          {experiment.ssim.toFixed(4)}
                        </td>

                        <td>
                          {experiment.nc.toFixed(4)}
                        </td>

                        <td>
                          {experiment.ber.toFixed(4)}
                        </td>

                        <td>
                          {new Date(
                            experiment.created_at
                          ).toLocaleString()}
                        </td>

                        <td>
                          <button
                            type="button"
                            className="history-delete-button"
                            onClick={async () => {
                              try {
                                await deleteExperiment(
                                  experiment.id
                                );

                                setExperimentHistory(
                                  (current) =>
                                    current.filter(
                                      (item) =>
                                        item.id !== experiment.id
                                    )
                                );

                                notify(
                                  "Experiment deleted.",
                                  "success"
                                );
                              } catch (error) {
                                notify(
                                  error instanceof Error
                                    ? error.message
                                    : "Failed to delete experiment.",
                                  "error"
                                );
                              }
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>


        {accountSettingsOpen && authUser && (
          <div
            className="account-modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setAccountSettingsOpen(false);
              }
            }}
          >
            <section
              className="account-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="account-settings-title"
            >
              <div className="account-modal-header">
                <div>
                  <span className="account-modal-eyebrow">ACCOUNT</span>
                  <h2 id="account-settings-title">Account Settings</h2>
                  <p>Manage your profile and active session.</p>
                </div>

                <button
                  type="button"
                  className="account-modal-close"
                  onClick={() => setAccountSettingsOpen(false)}
                  aria-label="Close account settings"
                >
                  ×
                </button>
              </div>

              <div className="account-profile-card">
                <span className="account-avatar account-avatar-profile">
                  {accountInitials}
                </span>
                <div>
                  <strong>{authUser.name}</strong>
                  <span>{authUser.email}</span>
                </div>
                <span className="account-active-badge">
                  <i />
                  Active
                </span>
              </div>

              <div className="account-settings-grid">
                <div className="account-setting-block">
                  <span className="account-setting-label">FULL NAME</span>
                  <strong>{authUser.name}</strong>
                </div>
                <div className="account-setting-block">
                  <span className="account-setting-label">EMAIL ADDRESS</span>
                  <strong>{authUser.email}</strong>
                </div>
              </div>

              <div className="account-security-card">
                <div>
                  <span className="account-security-icon">⌕</span>
                  <div>
                    <strong>Authentication</strong>
                    <p>Your account is protected by the application login system.</p>
                  </div>
                </div>
                <span className="account-security-status">SECURE</span>
              </div>

              <div className="account-modal-footer">
                <button
                  type="button"
                  className="account-secondary-button"
                  onClick={() => setAccountSettingsOpen(false)}
                >
                  Close
                </button>

                <button
                  type="button"
                  className="account-danger-button"
                  onClick={handleLogout}
                >
                  <span>↪</span>
                  Log out
                </button>
              </div>
            </section>
          </div>
        )}

        {/* =================================================

            FOOTER

        ================================================= */}



        <footer className="app-footer">



          <div>

            <strong>

              Hybrid DCT-DWT Image Watermarking

            </strong>



            <span>

              Research & Experimental Platform

            </span>

          </div>



          <div>

            FastAPI · React · OpenCV · PyWavelets

          </div>



        </footer>



      </main>



    </div>

  );

}



export default App;