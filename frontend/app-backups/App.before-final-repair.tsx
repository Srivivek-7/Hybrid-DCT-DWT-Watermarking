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
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");

type MessageKind = "success" | "error";

function App() {
  // ==========================================================
  // AUTHENTICATION
  // ==========================================================

  const [authenticated, setAuthenticated] = useState<boolean>(
    () => isAuthenticated()
  );

  const [authScreen, setAuthScreen] = useState<
    "login" | "register"
  >("login");

  const [authUser, setAuthUser] = useState<AuthUser | null>(
    () => getUser()
  );

  // ==========================================================
  // IMAGE STATE
  // ==========================================================

  const [originalFile, setOriginalFile] =
    useState<File | null>(null);

  const [watermarkFile, setWatermarkFile] =
    useState<File | null>(null);

  const [originalPreview, setOriginalPreview] =
    useState<string | null>(null);

  const [watermarkPreview, setWatermarkPreview] =
    useState<string | null>(null);

  const [watermarkedBlob, setWatermarkedBlob] =
    useState<Blob | null>(null);

  const [watermarkedImage, setWatermarkedImage] =
    useState<string | null>(null);

  const [extractedBlob, setExtractedBlob] =
    useState<Blob | null>(null);

  const [extractedImage, setExtractedImage] =
    useState<string | null>(null);

  // ==========================================================
  // CONFIGURATION
  // ==========================================================

  const [strength, setStrength] = useState(0.05);
  const [secretKey, setSecretKey] = useState("");

  // ==========================================================
  // RESULTS
  // ==========================================================

  const [metrics, setMetrics] =
    useState<Metrics | null>(null);

  const [experimentHistory, setExperimentHistory] =
    useState<Experiment[]>([]);

  const [historyLoading, setHistoryLoading] =
    useState(false);

  const [comparison, setComparison] =
    useState<Record<string, ComparisonItem> | null>(null);

  const [robustnessResults, setRobustnessResults] =
    useState<RobustnessResult[]>([]);

  // ==========================================================
  // LOADING / UI STATE
  // ==========================================================

  const [loading, setLoading] = useState(false);
  const [extractLoading, setExtractLoading] =
    useState(false);
  const [comparisonLoading, setComparisonLoading] =
    useState(false);
  const [robustnessLoading, setRobustnessLoading] =
    useState(false);

  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] =
    useState<MessageKind>("success");

  const [activeNav, setActiveNav] =
    useState("studio");

  const [apiOnline, setApiOnline] =
    useState(false);

  const [showSecretKey, setShowSecretKey] =
    useState(false);

  const [accountMenuOpen, setAccountMenuOpen] =
    useState(false);

  const [accountSettingsOpen, setAccountSettingsOpen] =
    useState(false);

  const [attackNames, setAttackNames] =
    useState<string[]>(DEFAULT_ATTACKS);

  const [dragTarget, setDragTarget] =
    useState<"original" | "watermark" | null>(null);

  // ==========================================================
  // NOTIFICATION
  // ==========================================================

  const notify = (
    text: string,
    kind: MessageKind
  ) => {
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

    // Clear current workspace.
    setOriginalFile(null);
    setWatermarkFile(null);

    setWatermarkedBlob(null);
    setExtractedBlob(null);

    setMetrics(null);
    setComparison(null);
    setRobustnessResults([]);

    // Clear history from the current user's UI.
    setExperimentHistory([]);
  };

  const accountInitials = authUser
    ? authUser.name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) =>
          part.charAt(0).toUpperCase()
        )
        .join("")
    : "U";

  const openAccountSettings = () => {
    setAccountMenuOpen(false);
    setAccountSettingsOpen(true);
  };

  // ==========================================================
  // IMAGE PREVIEWS
  // ==========================================================

  useEffect(() => {
    if (!originalFile) {
      setOriginalPreview(null);
      return;
    }

    const url =
      URL.createObjectURL(originalFile);

    setOriginalPreview(url);

    return () =>
      URL.revokeObjectURL(url);
  }, [originalFile]);

  useEffect(() => {
    if (!watermarkFile) {
      setWatermarkPreview(null);
      return;
    }

    const url =
      URL.createObjectURL(watermarkFile);

    setWatermarkPreview(url);

    return () =>
      URL.revokeObjectURL(url);
  }, [watermarkFile]);

  useEffect(() => {
    if (!watermarkedBlob) {
      setWatermarkedImage(null);
      return;
    }

    const url =
      URL.createObjectURL(watermarkedBlob);

    setWatermarkedImage(url);

    return () =>
      URL.revokeObjectURL(url);
  }, [watermarkedBlob]);

  useEffect(() => {
    if (!extractedBlob) {
      setExtractedImage(null);
      return;
    }

    const url =
      URL.createObjectURL(extractedBlob);

    setExtractedImage(url);

    return () =>
      URL.revokeObjectURL(url);
  }, [extractedBlob]);

  // ==========================================================
  // RESET RESULTS WHEN INPUT IMAGES CHANGE
  // ==========================================================

  useEffect(() => {
    setWatermarkedBlob(null);
    setExtractedBlob(null);
    setMetrics(null);
    setComparison(null);
    setRobustnessResults([]);
  }, [originalFile, watermarkFile]);

  // ==========================================================
  // LOAD EXPERIMENT HISTORY
  // ==========================================================

  useEffect(() => {
    if (!authenticated) {
      setExperimentHistory([]);
      return;
    }

    let mounted = true;

    const loadExperimentHistory = async () => {
      setHistoryLoading(true);

      try {
        const data = await getExperiments();

        if (mounted) {
          setExperimentHistory(data);
        }
      } catch (error) {
        console.error(
          "Failed to load experiment history:",
          error
        );

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

  // ==========================================================
  // API HEALTH
  // ==========================================================

  useEffect(() => {
    let mounted = true;

    const ping = async () => {
      const online = await checkHealth();

      if (mounted) {
        setApiOnline(online);
      }
    };

    ping();

    const timer =
      window.setInterval(ping, 8000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  // ==========================================================
  // LOAD ATTACKS
  // ==========================================================

  useEffect(() => {
    let mounted = true;

    apiJson<{ attacks: string[] }>("/attacks")
      .then((data) => {
        if (
          mounted &&
          data.attacks?.length
        ) {
          setAttackNames(data.attacks);
        }
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  // ==========================================================
  // NAVIGATION
  // ==========================================================

  const navigateTo = (id: string) => {
    setActiveNav(id);

    const element =
      document.getElementById(id);

    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  // ==========================================================
  // IMAGE VALIDATION
  // ==========================================================

  const acceptImage = (
    file: File | undefined | null,
    target: "original" | "watermark"
  ) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      notify(
        "Please choose an image file.",
        "error"
      );
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      notify(
        "Uploaded file is too large (max 20 MB).",
        "error"
      );
      return;
    }

    if (target === "original") {
      setOriginalFile(file);
    } else {
      setWatermarkFile(file);
    }
  };

  // ==========================================================
  // RESET WORKSPACE
  // ==========================================================

  const resetWorkspace = () => {
    setOriginalFile(null);
    setWatermarkFile(null);

    setWatermarkedBlob(null);
    setExtractedBlob(null);

    setMetrics(null);
    setComparison(null);
    setRobustnessResults([]);

    notify(
      "Workspace cleared.",
      "success"
    );
  };

  // ==========================================================
  // DRAG AND DROP
  // ==========================================================

  const handleDrop = (
    event: DragEvent<HTMLLabelElement>,
    target: "original" | "watermark"
  ) => {
    event.preventDefault();

    setDragTarget(null);

    acceptImage(
      event.dataTransfer.files?.[0],
      target
    );
  };

  // ==========================================================
  // EMBED WATERMARK
  // ==========================================================

  const handleEmbed = async () => {
    if (!originalFile || !watermarkFile) {
      notify(
        "Please select both the original image and watermark.",
        "error"
      );
      return;
    }

    if (!secretKey.trim()) {
      notify(
        "Please enter a secret key.",
        "error"
      );
      return;
    }

    setLoading(true);
    setMessage("");

    setMetrics(null);

    try {
      const formData = new FormData();

      /*
       * IMPORTANT:
       * These field names must match
       * FastAPI /watermark/process:
       *
       * image
       * watermark
       * alpha
       * secret_key
       */

      formData.append(
        "image",
        originalFile
      );

      formData.append(
        "watermark",
        watermarkFile
      );

      formData.append(
        "alpha",
        strength.toString()
      );

      formData.append(
        "secret_key",
        secretKey
      );

      const data =
        await apiJson<ProcessResponse>(
          "/watermark/process",
          {
            method: "POST",
            body: formData,
          }
        );

      setWatermarkedBlob(
        base64ToBlob(
          data.watermarked_image
        )
      );

      setExtractedBlob(
        base64ToBlob(
          data.extracted_watermark
        )
      );

      setMetrics(data.metrics);

      notify(
        data.color_preserved
          ? "Watermark embedded in the luminance channel. Color preserved."
          : "Watermark embedded successfully.",
        "success"
      );
    } catch (error) {
      console.error(
        "Watermark embedding failed:",
        error
      );

      notify(
        error instanceof Error
          ? error.message
          : "Something went wrong.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // EXTRACT WATERMARK
  // ==========================================================

  const handleExtract = async () => {
    if (!originalFile || !watermarkedBlob) {
      notify(
        "Upload an original image and embed or load a watermarked image first.",
        "error"
      );
      return;
    }

    if (!secretKey.trim()) {
      notify(
        "Please enter a secret key.",
        "error"
      );
      return;
    }

    setExtractLoading(true);
    setMessage("");

    try {
      const formData = new FormData();

      formData.append(
        "original_image",
        originalFile
      );

      formData.append(
        "watermarked_image",
        watermarkedBlob,
        "watermarked.png"
      );

      formData.append(
        "alpha",
        strength.toString()
      );

      formData.append(
        "secret_key",
        secretKey
      );

      const extracted =
        await apiBlob(
          "/watermark/extract",
          {
            method: "POST",
            body: formData,
          }
        );

      setExtractedBlob(extracted);

      notify(
        "Watermark extracted.",
        "success"
      );
    } catch (error) {
      console.error(
        "Watermark extraction failed:",
        error
      );

      notify(
        error instanceof Error
          ? error.message
          : "Extraction failed.",
        "error"
      );
    } finally {
      setExtractLoading(false);
    }
  };

  // ==========================================================
  // ALGORITHM COMPARISON
  // ==========================================================

  const handleComparison = async () => {
    if (!originalFile || !watermarkFile) {
      notify(
        "Select both images before comparison.",
        "error"
      );
      return;
    }

    if (!secretKey.trim()) {
      notify(
        "Enter a secret key before comparison.",
        "error"
      );
      return;
    }

    setComparisonLoading(true);
    setMessage("");

    try {
      const formData = new FormData();

      /*
       * These names MUST match FastAPI
       * /comparison/test
       */

      formData.append(
        "original_image",
        originalFile
      );

      formData.append(
        "original_watermark",
        watermarkFile
      );

      formData.append(
        "alpha",
        strength.toString()
      );

      formData.append(
        "secret_key",
        secretKey
      );

      const data =
        await apiJson<{
          alpha: number;
          comparison: Record<
            string,
            ComparisonItem
          >;
        }>("/comparison/test", {
          method: "POST",
          body: formData,
        });

      // Backend returns "comparison".
      setComparison(
        data.comparison
      );

      // ======================================================
      // SAVE HYBRID RESULT TO EXPERIMENT HISTORY
      // ======================================================

      try {
        const hybrid =
          data.comparison["Hybrid"];

        if (!hybrid) {
          throw new Error(
            "Hybrid result was not returned by the backend."
          );
        }

        const savedExperiment =
          await createExperiment({
            algorithm: "Hybrid",
            alpha: data.alpha,
            psnr: hybrid.PSNR_dB,
            ssim: hybrid.SSIM,
            nc: hybrid.NC,
            ber: hybrid.BER,
          });

        setExperimentHistory(
          (current) => [
            savedExperiment,
            ...current,
          ]
        );

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
      console.error(
        "Comparison failed:",
        error
      );

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

  // ==========================================================
  // ROBUSTNESS TEST
  // ==========================================================

  const handleRobustnessTest =
    async () => {
      if (
        !originalFile ||
        !watermarkFile ||
        !watermarkedBlob
      ) {
        notify(
          "Embed a watermark before running robustness tests.",
          "error"
        );
        return;
      }

      if (!secretKey.trim()) {
        notify(
          "Enter a secret key before robustness testing.",
          "error"
        );
        return;
      }

      setRobustnessLoading(true);
      setMessage("");

      try {
        const formData =
          new FormData();

        formData.append(
          "original_image",
          originalFile
        );

        formData.append(
          "watermarked_image",
          watermarkedBlob,
          "watermarked.png"
        );

        formData.append(
          "original_watermark",
          watermarkFile
        );

        formData.append(
          "alpha",
          strength.toString()
        );

        formData.append(
          "secret_key",
          secretKey
        );

        const data =
          await apiJson<{
            results: RobustnessResult[];
          }>("/robustness/test", {
            method: "POST",
            body: formData,
          });

        setRobustnessResults(
          data.results ?? []
        );

        notify(
          `${data.results?.length ?? 0} robustness attacks completed.`,
          "success"
        );
      } catch (error) {
        console.error(
          "Robustness testing failed:",
          error
        );

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

  // ==========================================================
  // DOWNLOAD
  // ==========================================================

  const downloadBlob = (
    blob: Blob | null,
    filename: string
  ) => {
    if (!blob) {
      notify(
        "No file available to download.",
        "error"
      );
      return;
    }

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);
  };

  // ==========================================================
  // COMPARISON DATA
  // ==========================================================

  const comparisonChartData =
    comparison
      ? Object.entries(comparison).map(
          ([algorithm, values]) => ({
            algorithm,
            PSNR: values.PSNR_dB,
            SSIM: values.SSIM,
            NC: values.NC,
            BER: values.BER,
          })
        )
      : [];

  // ==========================================================
  // BEST ALGORITHM
  // ==========================================================

  const bestAlgorithm =
    comparison
      ? Object.entries(comparison).reduce(
          (best, [algorithm, values]) =>
            values.NC >
            (comparison[best]?.NC ?? -Infinity)
              ? algorithm
              : best,
          Object.keys(comparison)[0] ?? ""
        )
      : "";

  // ==========================================================
  // ROBUSTNESS CHART DATA
  // ==========================================================

  const robustnessChartData =
    robustnessResults.map(
      (item) => ({
        attack: attackLabel(
          item.attack
        ),
        NC: item.NC,
        SSIM: item.SSIM,
        PSNR: item.PSNR_dB,
        BER: item.BER,
      })
    );

  // ==========================================================
  // AUTH SCREEN
  // ==========================================================

  if (!authenticated) {
    return authScreen === "login" ? (
      <Login
        onSuccess={handleAuthSuccess}
        onRegister={() =>
          setAuthScreen("register")
        }
      />
    ) : (
      <Register
        onSuccess={handleAuthSuccess}
        onLogin={() =>
          setAuthScreen("login")
        }
      />
    );
  }

  // ==========================================================
  // MAIN APPLICATION
  // ==========================================================


const renderMetricCard = (
label: string,
value: number | undefined,
suffix = "",
description = ""
  ) => {
if (value === undefined || Number.isNaN(value)) {
  return (
    <div className="metric-card">
<span className="metric-label">{label}</span>
<strong className="metric-value">—</strong>
{description && (
  <span className="metric-description">{description}</span>
)}
    </div>
  );
}

return (
  <div className="metric-card">
    <span className="metric-label">{label}</span>
    <strong className="metric-value">
{value.toFixed(4)}
{suffix}
    </strong>
    {description && (
<span className="metric-description">{description}</span>
    )}
  </div>
);
  };

  const renderComparisonTable = () => {
if (!comparison) {
  return (
    <div className="empty-state">
<div className="empty-icon">📊</div>
<h3>No comparison results yet</h3>
<p>
  Upload an image and watermark, then run the algorithm comparison.
</p>
    </div>
  );
}

const algorithms = ["DCT", "DWT", "Hybrid"];

return (
  <div className="comparison-results">
    <div className="section-heading">
<div>
  <span className="section-kicker">Algorithm Laboratory</span>
  <h2>DCT vs DWT vs Hybrid</h2>
  <p>
    Compare image quality and watermark recovery performance.
  </p>
</div>
    </div>

    <div className="comparison-table-wrapper">
<table className="comparison-table">
  <thead>
    <tr>
      <th>Algorithm</th>
      <th>PSNR (dB)</th>
      <th>SSIM</th>
      <th>NC</th>
      <th>BER</th>
    </tr>
  </thead>

  <tbody>
    {algorithms.map((algorithm) => {
      const item = comparison[algorithm];

      if (!item) {
        return null;
      }

      return (
        <tr
          key={algorithm}
          className={
            algorithm === "Hybrid"
              ? "comparison-highlight"
              : ""
          }
        >
          <td>
            <strong>{algorithm}</strong>
            {algorithm === "Hybrid" && (
              <span className="recommended-badge">
                Recommended
              </span>
            )}
          </td>

          <td>
            {Number(item.PSNR_dB).toFixed(4)}
          </td>

          <td>
            {Number(item.SSIM).toFixed(4)}
          </td>

          <td>
            {Number(item.NC).toFixed(4)}
          </td>

          <td>
            {Number(item.BER).toFixed(4)}
          </td>
        </tr>
      );
    })}
  </tbody>
</table>
    </div>

    <div className="comparison-chart-card">
<div className="chart-header">
  <div>
    <span className="section-kicker">Visual Analysis</span>
    <h3>PSNR Comparison</h3>
  </div>
</div>

<div className="chart-container">
  <ResponsiveContainer width="100%" height={320}>
    <BarChart
      data={algorithms
        .filter((algorithm) => comparison[algorithm])
        .map((algorithm) => ({
          algorithm,
          psnr: Number(comparison[algorithm].PSNR_dB),
        }))}
    >
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="algorithm" />
      <YAxis />
      <Tooltip />
      <Bar dataKey="psnr" name="PSNR (dB)" />
    </BarChart>
  </ResponsiveContainer>
</div>
    </div>
  </div>
);
  };

  const renderRobustnessResults = () => {
if (!robustnessResults.length) {
  return null;
}

const successfulResults = robustnessResults.filter(
  (item) =>
    item &&
    typeof item.NC === "number" &&
    typeof item.BER === "number"
);

return (
  <section className="results-section">
    <div className="section-heading">
<div>
  <span className="section-kicker">Robustness Analysis</span>
  <h2>Attack Simulation Results</h2>
  <p>
    Evaluate how the watermark behaves after common image attacks.
  </p>
</div>
    </div>

    <div className="robustness-table-wrapper">
<table className="comparison-table robustness-table">
  <thead>
    <tr>
      <th>Attack</th>
      <th>Strength</th>
      <th>PSNR</th>
      <th>SSIM</th>
      <th>NC</th>
      <th>BER</th>
    </tr>
  </thead>

  <tbody>
    {robustnessResults.map((result, index) => {
      if (result.error) {
        return (
          <tr key={`${result.attack}-${index}`}>
            <td>
              <strong>{result.attack}</strong>
            </td>
            <td>{result.strength ?? "—"}</td>
            <td colSpan={4} className="error-cell">
              {result.error}
            </td>
          </tr>
        );
      }

      return (
        <tr key={`${result.attack}-${index}`}>
          <td>
            <strong>{result.attack}</strong>
          </td>

          <td>{result.strength ?? "—"}</td>

          <td>
            {typeof result.PSNR_dB === "number"
              ? result.PSNR_dB.toFixed(4)
              : "—"}
          </td>

          <td>
            {typeof result.SSIM === "number"
              ? result.SSIM.toFixed(4)
              : "—"}
          </td>

          <td>
            {typeof result.NC === "number"
              ? result.NC.toFixed(4)
              : "—"}
          </td>

          <td>
            {typeof result.BER === "number"
              ? result.BER.toFixed(4)
              : "—"}
          </td>
        </tr>
      );
    })}
  </tbody>
</table>
    </div>

    {successfulResults.length > 0 && (
<div className="robustness-chart-grid">
  <div className="chart-card">
    <div className="chart-header">
      <div>
        <span className="section-kicker">Watermark Recovery</span>
        <h3>Normalized Correlation</h3>
      </div>
    </div>

    <div className="chart-container">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={successfulResults.map((item) => ({
            attack: item.attack,
            nc: item.NC,
          }))}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="attack" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="nc" name="NC" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>

  <div className="chart-card">
    <div className="chart-header">
      <div>
        <span className="section-kicker">Error Analysis</span>
        <h3>Bit Error Rate</h3>
      </div>
    </div>

    <div className="chart-container">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={successfulResults.map((item) => ({
            attack: item.attack,
            ber: item.BER,
          }))}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="attack" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="ber" name="BER" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
</div>
    )}
  </section>
);
  };

  const renderHistory = () => {
if (!authenticated) {
  return (
    <section className="history-section">
<div className="empty-state">
  <div className="empty-icon">🔐</div>
  <h3>Login required</h3>
  <p>
    Sign in to save and view your watermarking experiments.
  </p>
</div>
    </section>
  );
}

if (historyLoading) {
  return (
    <section className="history-section">
<div className="loading-state">
  <div className="spinner" />
  <p>Loading experiment history...</p>
</div>
    </section>
  );
}

return (
  <section className="history-section">
    <div className="section-heading">
<div>
  <span className="section-kicker">Experiment History</span>
  <h2>Your Previous Experiments</h2>
  <p>
    Saved watermarking experiments associated with your account.
  </p>
</div>

{experimentHistory.length > 0 && (
  <span className="history-count">
    {experimentHistory.length} experiment
    {experimentHistory.length === 1 ? "" : "s"}
  </span>
)}
    </div>

    {experimentHistory.length === 0 ? (
<div className="empty-state">
  <div className="empty-icon">🧪</div>
  <h3>No experiments saved</h3>
  <p>
    Run a watermarking or algorithm comparison experiment and
    the results will appear here.
  </p>
</div>
    ) : (
<div className="history-grid">
  {experimentHistory.map((experiment) => (
    <article
      className="history-card"
      key={experiment.id}
    >
      <div className="history-card-header">
        <div>
          <span className="history-algorithm">
            {experiment.algorithm}
          </span>

          <span className="history-date">
            {new Date(
              experiment.created_at
            ).toLocaleString()}
          </span>
        </div>

        <button
          type="button"
          className="history-delete-button"
          onClick={() =>
            handleDeleteExperiment(experiment.id)
          }
          aria-label={`Delete experiment ${experiment.id}`}
        >
          🗑
        </button>
      </div>

      <div className="history-alpha">
        <span>Embedding strength</span>
        <strong>
          {Number(experiment.alpha).toFixed(3)}
        </strong>
      </div>

      <div className="history-metrics">
        {renderMetricCard(
          "PSNR",
          experiment.psnr,
          " dB",
          "Image quality"
        )}

        {renderMetricCard(
          "SSIM",
          experiment.ssim,
          "",
          "Structural similarity"
        )}

        {renderMetricCard(
          "NC",
          experiment.nc,
          "",
          "Watermark correlation"
        )}

        {renderMetricCard(
          "BER",
          experiment.ber,
          "",
          "Bit error rate"
        )}
      </div>
    </article>
  ))}
</div>
    )}
  </section>
);
  };


  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">
            H
          </div>

          <div>
            <strong>
              Hybrid DCT-DWT
            </strong>

            <span>
              Image Watermarking
            </span>
          </div>
        </div>

        <nav className="main-nav">
          <button
            type="button"
            className={
              activeNav === "studio"
                ? "active"
                : ""
            }
            onClick={() =>
              navigateTo("studio")
            }
          >
            Studio
          </button>

          <button
            type="button"
            className={
              activeNav === "quality"
                ? "active"
                : ""
            }
            onClick={() =>
              navigateTo("quality")
            }
          >
            Quality
          </button>

          <button
            type="button"
            className={
              activeNav === "comparison"
                ? "active"
                : ""
            }
            onClick={() =>
              navigateTo("comparison")
            }
          >
            Laboratory
          </button>

          <button
            type="button"
            className={
              activeNav === "robustness"
                ? "active"
                : ""
            }
            onClick={() =>
              navigateTo("robustness")
            }
          >
            Robustness
          </button>

          <button
            type="button"
            className={
              activeNav === "history"
                ? "active"
                : ""
            }
            onClick={() =>
              navigateTo("history")
            }
          >
            History
          </button>
        </nav>

        <div className="header-actions">
          <div className="api-status">
            <span
              className={
                apiOnline
                  ? "status-dot online"
                  : "status-dot"
              }
            />

            <span>
              {apiOnline
                ? "API Online"
                : "API Offline"}
            </span>
          </div>

          <div className="account-area">
            <button
              type="button"
              className="account-button"
              onClick={() =>
                setAccountMenuOpen(
                  (value) => !value
                )
              }
            >
              <span className="account-avatar">
                {accountInitials}
              </span>

              <span className="account-name">
                {authUser?.name ??
                  "Account"}
              </span>

              <span>
                ▾
              </span>
            </button>

            {accountMenuOpen && (
              <div className="account-dropdown">
                <button
                  type="button"
                  onClick={
                    openAccountSettings
                  }
                >
                  Account Settings
                </button>

                <button
                  type="button"
                  onClick={
                    handleLogout
                  }
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        {/* =================================================
            HERO
        ================================================= */}

        <section className="hero-section">
          <div className="hero-copy">
            <span className="hero-eyebrow">
              SECURE IMAGE RESEARCH
            </span>

            <h1>
              Hybrid DCT-DWT
              <br />
              <span>
                Image Watermarking
              </span>
            </h1>

            <p>
              Protect digital images with a
              hybrid frequency-domain
              watermarking pipeline designed
              for quality, recovery and
              robustness analysis.
            </p>

            <div className="hero-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  navigateTo("studio")
                }
              >
                Start Experiment →
              </button>

              <button
                type="button"
                className="outline-button"
                onClick={() =>
                  navigateTo("comparison")
                }
              >
                Algorithm Laboratory
              </button>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-grid">
              <div />
              <div />
              <div />
              <div />
            </div>

            <div className="hero-orbit">
              <span>
                DCT
              </span>

              <span>
                DWT
              </span>

              <span>
                HYBRID
              </span>
            </div>
          </div>
        </section>

        {/* =================================================
            STUDIO
        ================================================= */}

        <section
          id="studio"
          className="dashboard-section"
        >
          <div className="section-heading">
            <div>
              <span className="section-number">
                01
              </span>

              <div>
                <h2>
                  Watermark Studio
                </h2>

                <p>
                  Upload your source image
                  and watermark to begin.
                </p>
              </div>
            </div>

            <div className="section-actions">
              <button
                type="button"
                className="text-button"
                onClick={
                  resetWorkspace
                }
              >
                Reset Workspace
              </button>
            </div>
          </div>

          {/* IMAGE UPLOADS */}

          <div className="upload-grid">
            <div className="upload-card">
              <div className="upload-card-header">
                <div>
                  <span className="upload-number">
                    01
                  </span>

                  <h3>
                    Original Image
                  </h3>
                </div>

                <span className="upload-type">
                  SOURCE
                </span>
              </div>

              <label
                className={`drop-zone ${
                  dragTarget === "original"
                    ? "drag-active"
                    : ""
                }`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragTarget(
                    "original"
                  );
                }}
                onDragLeave={() =>
                  setDragTarget(null)
                }
                onDrop={(event) =>
                  handleDrop(
                    event,
                    "original"
                  )
                }
              >
                {originalPreview ? (
                  <img
                    src={originalPreview}
                    alt="Original preview"
                  />
                ) : (
                  <>
                    <div className="drop-icon">
                      +
                    </div>

                    <strong>
                      Drop image here
                    </strong>

                    <span>
                      or click to browse
                      files
                    </span>
                  </>
                )}

                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    acceptImage(
                      event.target.files?.[0],
                      "original"
                    )
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

            <div className="upload-card">
              <div className="upload-card-header">
                <div>
                  <span className="upload-number">
                    02
                  </span>

                  <h3>
                    Watermark Image
                  </h3>
                </div>

                <span className="upload-type">
                  PAYLOAD
                </span>
              </div>

              <label
                className={`drop-zone ${
                  dragTarget ===
                  "watermark"
                    ? "drag-active"
                    : ""
                }`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragTarget(
                    "watermark"
                  );
                }}
                onDragLeave={() =>
                  setDragTarget(null)
                }
                onDrop={(event) =>
                  handleDrop(
                    event,
                    "watermark"
                  )
                }
              >
                {watermarkPreview ? (
                  <img
                    src={watermarkPreview}
                    alt="Watermark preview"
                  />
                ) : (
                  <>
                    <div className="drop-icon">
                      +
                    </div>

                    <strong>
                      Drop watermark here
                    </strong>

                    <span>
                      or click to browse
                      files
                    </span>
                  </>
                )}

                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    acceptImage(
                      event.target.files?.[0],
                      "watermark"
                    )
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

                <h3>
                  Embedding Parameters
                </h3>
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
                  <span>
                    ⌘
                  </span>

                  <input
                    type={
                      showSecretKey
                        ? "text"
                        : "password"
                    }
                    value={secretKey}
                    onChange={(event) =>
                      setSecretKey(
                        event.target.value
                      )
                    }
                    placeholder="Enter secure secret key"
                  />

                  <button
                    type="button"
                    className="key-toggle"
                    onClick={() =>
                      setShowSecretKey(
                        (value) =>
                          !value
                      )
                    }
                  >
                    {showSecretKey
                      ? "Hide"
                      : "Show"}
                  </button>
                </div>

                <small>
                  Used to scramble and
                  recover the watermark.
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
                  onChange={(event) =>
                    setStrength(
                      Number(
                        event.target.value
                      )
                    )
                  }
                />

                <div className="slider-range">
                  <span>
                    0.01
                  </span>

                  <span>
                    0.20
                  </span>
                </div>
              </div>
            </div>

            <div className="action-row">
              <button
                className="primary-button"
                onClick={handleEmbed}
                disabled={
                  loading ||
                  extractLoading
                }
              >
                <span>
                  {loading
                    ? "Processing..."
                    : "✦ Embed Watermark"}
                </span>

                <span>
                  →
                </span>
              </button>

              <button
                type="button"
                className="outline-button extract-button"
                onClick={
                  handleExtract
                }
                disabled={
                  extractLoading ||
                  loading ||
                  !watermarkedBlob
                }
              >
                {extractLoading
                  ? "Extracting..."
                  : "Extract Watermark"}
              </button>
            </div>
          </div>

          {message && (
            <div
              className={
                messageKind ===
                "error"
                  ? "message error"
                  : "message success"
              }
              role={
                messageKind ===
                "error"
                  ? "alert"
                  : "status"
              }
            >
              <span>
                {messageKind ===
                "error"
                  ? "!"
                  : "✓"}
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
                  <h2>
                    Watermark Result
                  </h2>

                  <p>
                    Your protected image
                    has been generated.
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
                  <span>
                    WATERMARKED IMAGE
                  </span>

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
                  ↓ Download
                  Watermarked Image
                </button>
              </div>

              {extractedImage && (
                <div className="result-image-card">
                  <div className="result-image-header">
                    <span>
                      EXTRACTED WATERMARK
                    </span>

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
                    ↓ Download
                    Extracted Watermark
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* =================================================
            QUALITY
        ================================================= */}

        <section
          id="quality"
          className="dashboard-section"
        >
          <div className="section-heading">
            <div>
              <span className="section-number">
                02
              </span>

              <div>
                <h2>
                  Quality Analysis
                </h2>

                <p>
                  Measure visual quality
                  and watermark recovery.
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
                <span>
                  PSNR
                </span>

                <strong>
                  {metrics.PSNR_dB.toFixed(
                    2
                  )}
                </strong>

                <small>
                  dB · Image Quality
                </small>
              </div>

              <div className="metric-card cyan-accent">
                <span>
                  SSIM
                </span>

                <strong>
                  {metrics.SSIM.toFixed(
                    4
                  )}
                </strong>

                <small>
                  Structural Similarity
                </small>
              </div>

              <div className="metric-card violet-accent">
                <span>
                  NC
                </span>

                <strong>
                  {metrics.NC.toFixed(
                    4
                  )}
                </strong>

                <small>
                  Normalized Correlation
                </small>
              </div>

              <div className="metric-card pink-accent">
                <span>
                  BER
                </span>

                <strong>
                  {metrics.BER.toFixed(
                    4
                  )}
                </strong>

                <small>
                  Bit Error Rate
                </small>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">
                ◌
              </div>

              <h3>
                No analysis available
              </h3>

              <p>
                Embed a watermark to
                generate quality metrics.
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
                <h2>
                  Algorithm Laboratory
                </h2>

                <p>
                  Compare DCT, DWT and
                  Hybrid performance.
                </p>
              </div>
            </div>

            <button
              className="outline-button"
              onClick={
                handleComparison
              }
              disabled={
                comparisonLoading ||
                loading
              }
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
                      <th>
                        Algorithm
                      </th>

                      <th>
                        PSNR
                      </th>

                      <th>
                        SSIM
                      </th>

                      <th>
                        NC
                      </th>

                      <th>
                        BER
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {Object.entries(
                      comparison
                    ).map(
                      ([
                        algorithm,
                        values,
                      ]) => (
                        <tr
                          key={
                            algorithm
                          }
                          className={
                            algorithm ===
                            bestAlgorithm
                              ? "winner-row"
                              : undefined
                          }
                        >
                          <td>
                            <div className="algorithm-name">
                              <span
                                className={`algorithm-marker ${algorithm
                                  .toLowerCase()
                                  .replaceAll(
                                    " ",
                                    "-"
                                  )}`}
                              />

                              {algorithm}

                              {algorithm ===
                              bestAlgorithm ? (
                                <em className="winner-tag">
                                  best NC
                                </em>
                              ) : null}
                            </div>
                          </td>

                          <td>
                            {values.PSNR_dB.toFixed(
                              2
                            )}{" "}
                            dB
                          </td>

                          <td>
                            {values.SSIM.toFixed(
                              4
                            )}
                          </td>

                          <td>
                            {values.NC.toFixed(
                              4
                            )}
                          </td>

                          <td>
                            {values.BER.toFixed(
                              4
                            )}
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
                      <span>
                        VISUAL QUALITY
                      </span>

                      <h3>
                        PSNR Comparison
                      </h3>
                    </div>
                  </div>

                  <ResponsiveContainer
                    width="100%"
                    height={300}
                  >
                    <BarChart
                      data={
                        comparisonChartData
                      }
                    >
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
                          background:
                            "#111827",
                          border:
                            "1px solid rgba(255,255,255,.1)",
                          borderRadius:
                            "10px",
                        }}
                      />

                      <Bar
                        dataKey="PSNR"
                        fill="#4f8cff"
                        radius={[
                          6,
                          6,
                          0,
                          0,
                        ]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-card">
                  <div className="chart-header">
                    <div>
                      <span>
                        WATERMARK RECOVERY
                      </span>

                      <h3>
                        NC Comparison
                      </h3>
                    </div>
                  </div>

                  <ResponsiveContainer
                    width="100%"
                    height={300}
                  >
                    <BarChart
                      data={
                        comparisonChartData
                      }
                    >
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
                          background:
                            "#111827",
                          border:
                            "1px solid rgba(255,255,255,.1)",
                          borderRadius:
                            "10px",
                        }}
                      />

                      <Bar
                        dataKey="NC"
                        fill="#8b5cf6"
                        radius={[
                          6,
                          6,
                          0,
                          0,
                        ]}
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

              <h3>
                Algorithm comparison
              </h3>

              <p>
                Run the comparison to
                evaluate DCT, DWT and
                Hybrid DCT-DWT.
              </p>

              <button
                className="primary-small-button"
                onClick={
                  handleComparison
                }
                disabled={
                  comparisonLoading ||
                  loading
                }
              >
                {comparisonLoading
                  ? "Running..."
                  : "Run Analysis"}
              </button>
            </div>
          )}
        </section>
           {/* =================================================
            ROBUSTNESS
        ================================================= */}

        <section
          id="robustness"
          className="dashboard-section"
        >
          <div className="section-heading">
            <div>
              <span className="section-number">
                04
              </span>

              <div>
                <h2>
                  Robustness Laboratory
                </h2>

                <p>
                  Test watermark recovery against
                  common image attacks.
                </p>
              </div>
            </div>

            <div className="section-tag">
              {attackNames.length} ATTACKS
            </div>
          </div>

          <div className="robustness-intro">
            <div className="robustness-copy">
              <span className="panel-number">
                ADVERSARIAL TESTING
              </span>

              <h3>
                Stress-test your watermark
              </h3>

              <p>
                The system applies multiple
                image-processing attacks to the
                watermarked image and measures
                PSNR, SSIM, NC and BER after
                watermark extraction.
              </p>
            </div>

            <button
              type="button"
              className="primary-button"
              onClick={handleRobustnessTest}
              disabled={
                robustnessLoading ||
                loading ||
                !watermarkedBlob
              }
            >
              {robustnessLoading
                ? "Testing..."
                : "Run Robustness Test →"}
            </button>
          </div>

          <div className="attack-list">
            {attackNames.map(
              (attack, index) => (
                <div
                  className="attack-chip"
                  key={attack}
                >
                  <span>
                    {String(index + 1).padStart(
                      2,
                      "0"
                    )}
                  </span>

                  <strong>
                    {attackLabel(attack)}
                  </strong>
                </div>
              )
            )}
          </div>

          {robustnessResults.length > 0 && (
            <>
              <div className="robustness-summary">
                <div className="summary-card">
                  <span>
                    ATTACKS TESTED
                  </span>

                  <strong>
                    {robustnessResults.length}
                  </strong>
                </div>

                <div className="summary-card">
                  <span>
                    AVERAGE NC
                  </span>

                  <strong>
                    {(
                      robustnessResults.reduce(
                        (sum, item) =>
                          sum +
                          (item.NC ?? 0),
                        0
                      ) /
                      robustnessResults.length
                    ).toFixed(4)}
                  </strong>
                </div>

                <div className="summary-card">
                  <span>
                    AVERAGE SSIM
                  </span>

                  <strong>
                    {(
                      robustnessResults.reduce(
                        (sum, item) =>
                          sum +
                          (item.SSIM ?? 0),
                        0
                      ) /
                      robustnessResults.length
                    ).toFixed(4)}
                  </strong>
                </div>

                <div className="summary-card">
                  <span>
                    AVERAGE BER
                  </span>

                  <strong>
                    {(
                      robustnessResults.reduce(
                        (sum, item) =>
                          sum +
                          (item.BER ?? 0),
                        0
                      ) /
                      robustnessResults.length
                    ).toFixed(4)}
                  </strong>
                </div>
              </div>

              <div className="comparison-table-wrapper">
                <table className="comparison-table robustness-table">
                  <thead>
                    <tr>
                      <th>
                        Attack
                      </th>

                      <th>
                        Strength
                      </th>

                      <th>
                        PSNR
                      </th>

                      <th>
                        SSIM
                      </th>

                      <th>
                        NC
                      </th>

                      <th>
                        BER
                      </th>

                      <th>
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {robustnessResults.map(
                      (item) => {
                        const failed =
                          "error" in item &&
                          Boolean(item.error);

                        return (
                          <tr
                            key={
                              item.attack
                            }
                          >
                            <td>
                              <strong>
                                {attackLabel(
                                  item.attack
                                )}
                              </strong>
                            </td>

                            <td>
                              {item.strength}
                            </td>

                            {failed ? (
                              <>
                                <td colSpan={4}>
                                  <span className="error-text">
                                    {item.error}
                                  </span>
                                </td>

                                <td>
                                  <span className="status-badge failed">
                                    FAILED
                                  </span>
                                </td>
                              </>
                            ) : (
                              <>
                                <td>
                                  {item.PSNR_dB.toFixed(
                                    2
                                  )}{" "}
                                  dB
                                </td>

                                <td>
                                  {item.SSIM.toFixed(
                                    4
                                  )}
                                </td>

                                <td>
                                  {item.NC.toFixed(
                                    4
                                  )}
                                </td>

                                <td>
                                  {item.BER.toFixed(
                                    4
                                  )}
                                </td>

                                <td>
                                  <span className="status-badge passed">
                                    COMPLETE
                                  </span>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>

              <div className="charts-grid">
                <div className="chart-card">
                  <div className="chart-header">
                    <div>
                      <span>
                        ROBUSTNESS
                      </span>

                      <h3>
                        NC by Attack
                      </h3>
                    </div>
                  </div>

                  <ResponsiveContainer
                    width="100%"
                    height={340}
                  >
                    <BarChart
                      data={
                        robustnessChartData
                      }
                      layout="vertical"
                      margin={{
                        left: 20,
                        right: 20,
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.06)"
                      />

                      <XAxis
                        type="number"
                        domain={[0, 1]}
                        stroke="#7d8799"
                      />

                      <YAxis
                        type="category"
                        dataKey="attack"
                        width={130}
                        stroke="#7d8799"
                      />

                      <Tooltip
                        contentStyle={{
                          background:
                            "#111827",
                          border:
                            "1px solid rgba(255,255,255,.1)",
                          borderRadius:
                            "10px",
                        }}
                      />

                      <Bar
                        dataKey="NC"
                        fill="#22c55e"
                        radius={[
                          0,
                          6,
                          6,
                          0,
                        ]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-card">
                  <div className="chart-header">
                    <div>
                      <span>
                        IMAGE QUALITY
                      </span>

                      <h3>
                        SSIM by Attack
                      </h3>
                    </div>
                  </div>

                  <ResponsiveContainer
                    width="100%"
                    height={340}
                  >
                    <BarChart
                      data={
                        robustnessChartData
                      }
                      layout="vertical"
                      margin={{
                        left: 20,
                        right: 20,
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.06)"
                      />

                      <XAxis
                        type="number"
                        domain={[0, 1]}
                        stroke="#7d8799"
                      />

                      <YAxis
                        type="category"
                        dataKey="attack"
                        width={130}
                        stroke="#7d8799"
                      />

                      <Tooltip
                        contentStyle={{
                          background:
                            "#111827",
                          border:
                            "1px solid rgba(255,255,255,.1)",
                          borderRadius:
                            "10px",
                        }}
                      />

                      <Bar
                        dataKey="SSIM"
                        fill="#06b6d4"
                        radius={[
                          0,
                          6,
                          6,
                          0,
                        ]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {robustnessResults.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">
                ◈
              </div>

              <h3>
                No robustness results
              </h3>

              <p>
                Embed a watermark first,
                then run the robustness
                laboratory.
              </p>

              <button
                type="button"
                className="primary-small-button"
                onClick={
                  handleRobustnessTest
                }
                disabled={
                  robustnessLoading ||
                  !watermarkedBlob
                }
              >
                {robustnessLoading
                  ? "Testing..."
                  : "Run Robustness Test"}
              </button>
            </div>
          )}
        </section>

        {/* =================================================
            EXPERIMENT HISTORY
        ================================================= */}

        <section
          id="history"
          className="dashboard-section"
        >
          <div className="section-heading">
            <div>
              <span className="section-number">
                05
              </span>

              <div>
                <h2>
                  Experiment History
                </h2>

                <p>
                  Review your saved algorithm
                  comparison experiments.
                </p>
              </div>
            </div>

            <div className="section-tag">
              {experimentHistory.length} SAVED
            </div>
          </div>

          {historyLoading ? (
            <div className="history-empty">
              <div className="empty-icon">
                ◌
              </div>

              <strong>
                Loading experiment history...
              </strong>
            </div>
          ) : experimentHistory.length === 0 ? (
            <div className="history-empty">
              <div className="empty-icon">
                ◫
              </div>

              <strong>
                No experiments yet
              </strong>

              <span>
                Run an algorithm comparison
                to save your experiment
                results here.
              </span>

              <button
                type="button"
                className="primary-small-button"
                onClick={() =>
                  navigateTo(
                    "comparison"
                  )
                }
              >
                Open Algorithm Laboratory
              </button>
            </div>
          ) : (
            <div className="history-card">
              <div className="history-table-wrapper">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>
                        Algorithm
                      </th>

                      <th>
                        Alpha
                      </th>

                      <th>
                        PSNR
                      </th>

                      <th>
                        SSIM
                      </th>

                      <th>
                        NC
                      </th>

                      <th>
                        BER
                      </th>

                      <th>
                        Date
                      </th>

                      <th>
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {experimentHistory.map(
                      (experiment) => (
                        <tr
                          key={
                            experiment.id
                          }
                        >
                          <td>
                            <strong>
                              {
                                experiment.algorithm
                              }
                            </strong>
                          </td>

                          <td>
                            {experiment.alpha.toFixed(
                              2
                            )}
                          </td>

                          <td>
                            {experiment.psnr.toFixed(
                              2
                            )}{" "}
                            dB
                          </td>

                          <td>
                            {experiment.ssim.toFixed(
                              4
                            )}
                          </td>

                          <td>
                            {experiment.nc.toFixed(
                              4
                            )}
                          </td>

                          <td>
                            {experiment.ber.toFixed(
                              4
                            )}
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
                                        (
                                          item
                                        ) =>
                                          item.id !==
                                          experiment.id
                                      )
                                  );

                                  notify(
                                    "Experiment deleted.",
                                    "success"
                                  );
                                } catch (
                                  error
                                ) {
                                  console.error(
                                    "Failed to delete experiment:",
                                    error
                                  );

                                  notify(
                                    error instanceof
                                      Error
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
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* =================================================
            FINAL RESULTS / PROJECT SUMMARY
        ================================================= */}

        <section className="dashboard-section final-results-section">
          <div className="section-heading">
            <div>
              <span className="section-number">
                06
              </span>

              <div>
                <h2>
                  Experiment Summary
                </h2>

                <p>
                  A quick overview of the
                  current workspace.
                </p>
              </div>
            </div>
          </div>

          <div className="summary-grid">
            <div className="summary-panel">
              <span>
                CURRENT ALGORITHM
              </span>

              <strong>
                Hybrid DCT-DWT
              </strong>

              <small>
                Frequency-domain
                watermarking
              </small>
            </div>

            <div className="summary-panel">
              <span>
                EMBEDDING STRENGTH
              </span>

              <strong>
                {strength.toFixed(2)}
              </strong>

              <small>
                Current alpha value
              </small>
            </div>

            <div className="summary-panel">
              <span>
                ATTACK COVERAGE
              </span>

              <strong>
                {attackNames.length}
              </strong>

              <small>
                Configured robustness
                attacks
              </small>
            </div>

            <div className="summary-panel">
              <span>
                SAVED EXPERIMENTS
              </span>

              <strong>
                {experimentHistory.length}
              </strong>

              <small>
                Experiments in your account
              </small>
            </div>
          </div>
        </section>
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            HV
          </div>

          <div className="brand-text">
            <strong>HybridVault</strong>
            <span>DCT–DWT Watermarking</span>
          </div>
        </div>

        <nav className="top-navigation">
          <button
            type="button"
            className={
              activeTab === "watermark"
                ? "nav-button active"
                : "nav-button"
            }
            onClick={() => setActiveTab("watermark")}
          >
            Watermark
          </button>

          <button
            type="button"
            className={
              activeTab === "laboratory"
                ? "nav-button active"
                : "nav-button"
            }
            onClick={() => setActiveTab("laboratory")}
          >
            Algorithm Lab
          </button>

          <button
            type="button"
            className={
              activeTab === "robustness"
                ? "nav-button active"
                : "nav-button"
            }
            onClick={() => setActiveTab("robustness")}
          >
            Robustness
          </button>

          <button
            type="button"
            className={
              activeTab === "history"
                ? "nav-button active"
                : "nav-button"
            }
            onClick={() => setActiveTab("history")}
          >
            History
          </button>
        </nav>

        <div className="topbar-actions">
          <div
            className={
              backendStatus === "online"
                ? "backend-status online"
                : backendStatus === "checking"
                  ? "backend-status checking"
                  : "backend-status offline"
            }
          >
            <span className="status-dot" />
            {backendStatus === "online"
              ? "Backend online"
              : backendStatus === "checking"
                ? "Checking..."
                : "Backend offline"}
          </div>

          {authenticated && user ? (
            <div className="account-wrapper">
              <button
                type="button"
                className="account-button"
                onClick={() =>
                  setAccountMenuOpen((current) => !current)
                }
              >
                <span className="account-avatar">
                  {user.name?.charAt(0)?.toUpperCase() || "U"}
                </span>

                <span className="account-name">
                  {user.name}
                </span>

                <span className="account-chevron">
                  {accountMenuOpen ? "▲" : "▼"}
                </span>
              </button>

              {accountMenuOpen && (
                <div className="account-menu">
                  <div className="account-menu-user">
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("history");
                      setAccountMenuOpen(false);
                    }}
                  >
                    🧪 Experiment History
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("watermark");
                      setAccountMenuOpen(false);
                    }}
                  >
                    🖼 Watermark Studio
                  </button>

                  <button
                    type="button"
                    className="account-logout"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      handleLogout();
                    }}
                  >
                    ↪ Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="login-button"
              onClick={() => setShowLogin(true)}
            >
              Login
            </button>
          )}
        </div>
      </header>

      <main className="main-content">
        <section className="hero-section">
          <div className="hero-copy">
            <span className="hero-kicker">
              SECURE DIGITAL MEDIA
            </span>

            <h1>
              Hybrid DCT–DWT
              <br />
              <span>Image Watermarking</span>
            </h1>

            <p>
              Embed secure invisible watermarks, measure visual
              quality, compare transform-domain algorithms, and
              test robustness against real-world image attacks.
            </p>

            <div className="hero-tags">
              <span>DCT</span>
              <span>DWT</span>
              <span>Hybrid</span>
              <span>PSNR</span>
              <span>SSIM</span>
              <span>NC</span>
              <span>BER</span>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <div className="hero-orbit orbit-three" />

            <div className="hero-core">
              <div className="hero-core-inner">
                <span>HYBRID</span>
                <strong>DCT</strong>
                <strong>+</strong>
                <strong>DWT</strong>
              </div>
            </div>

            <div className="hero-floating-card card-one">
              <span>PSNR</span>
              <strong>
                {metrics?.PSNR_dB
                  ? metrics.PSNR_dB.toFixed(2)
                  : "—"}
              </strong>
              <small>dB</small>
            </div>

            <div className="hero-floating-card card-two">
              <span>SSIM</span>
              <strong>
                {metrics?.SSIM
                  ? metrics.SSIM.toFixed(3)
                  : "—"}
              </strong>
            </div>

            <div className="hero-floating-card card-three">
              <span>NC</span>
              <strong>
                {metrics?.NC
                  ? metrics.NC.toFixed(3)
                  : "—"}
              </strong>
            </div>
          </div>
        </section>

        {activeTab === "watermark" && (
          <>
            <section className="workspace-section">
              <div className="workspace-heading">
                <div>
                  <span className="section-kicker">
                    Watermark Studio
                  </span>

                  <h2>
                    Embed & Extract
                  </h2>

                  <p>
                    Protect an image using the Hybrid DCT–DWT
                    watermarking pipeline.
                  </p>
                </div>

                <div className="algorithm-pill">
                  <span className="algorithm-pill-dot" />
                  Hybrid DCT–DWT
                </div>
              </div>

              <div className="workspace-grid">
                <div className="upload-panel">
                  <div className="panel-heading">
                    <span className="panel-number">01</span>

                    <div>
                      <h3>Original Image</h3>
                      <p>
                        Select the image that will contain
                        the watermark.
                      </p>
                    </div>
                  </div>

                  <div
                    className={
                      originalFile
                        ? "dropzone has-file"
                        : "dropzone"
                    }
                    onDragOver={(event) =>
                      event.preventDefault()
                    }
                    onDrop={(event) =>
                      handleOriginalDrop(event)
                    }
                    onClick={() =>
                      originalInputRef.current?.click()
                    }
                  >
                    <input
                      ref={originalInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(event) =>
                        handleOriginalFile(
                          event.target.files?.[0] || null
                        )
                      }
                    />

                    {originalPreview ? (
                      <div className="preview-area">
                        <img
                          src={originalPreview}
                          alt="Original preview"
                        />

                        <div className="preview-overlay">
                          <span>Change image</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="drop-icon">
                          ↑
                        </div>

                        <strong>
                          Drop image here
                        </strong>

                        <span>
                          or click to browse
                        </span>

                        <small>
                          PNG, JPG, JPEG • Max 20 MB
                        </small>
                      </>
                    )}
                  </div>

                  {originalFile && (
                    <div className="file-info">
                      <span>✓</span>
                      <div>
                        <strong>
                          {originalFile.name}
                        </strong>
                        <small>
                          {formatFileSize(
                            originalFile.size
                          )}
                        </small>
                      </div>
                    </div>
                  )}
                </div>

                <div className="upload-panel">
                  <div className="panel-heading">
                    <span className="panel-number">02</span>

                    <div>
                      <h3>Watermark</h3>
                      <p>
                        Select the image or logo to embed.
                      </p>
                    </div>
                  </div>

                  <div
                    className={
                      watermarkFile
                        ? "dropzone has-file"
                        : "dropzone"
                    }
                    onDragOver={(event) =>
                      event.preventDefault()
                    }
                    onDrop={(event) =>
                      handleWatermarkDrop(event)
                    }
                    onClick={() =>
                      watermarkInputRef.current?.click()
                    }
                  >
                    <input
                      ref={watermarkInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(event) =>
                        handleWatermarkFile(
                          event.target.files?.[0] || null
                        )
                      }
                    />

                    {watermarkPreview ? (
                      <div className="preview-area watermark-preview">
                        <img
                          src={watermarkPreview}
                          alt="Watermark preview"
                        />

                        <div className="preview-overlay">
                          <span>Change watermark</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="drop-icon">
                          ◈
                        </div>

                        <strong>
                          Drop watermark here
                        </strong>

                        <span>
                          or click to browse
                        </span>

                        <small>
                          PNG, JPG, JPEG • Max 20 MB
                        </small>
                      </>
                    )}
                  </div>

                  {watermarkFile && (
                    <div className="file-info">
                      <span>✓</span>
                      <div>
                        <strong>
                          {watermarkFile.name}
                        </strong>
                        <small>
                          {formatFileSize(
                            watermarkFile.size
                          )}
                        </small>
                      </div>
                    </div>
                  )}
                </div>

                <div className="settings-panel">
                  <div className="panel-heading">
                    <span className="panel-number">03</span>

                    <div>
                      <h3>Security Settings</h3>
                      <p>
                        Configure embedding strength and
                        secret-key protection.
                      </p>
                    </div>
                  </div>

                  <div className="setting-group">
                    <div className="setting-label-row">
                      <label htmlFor="strength">
                        Embedding Strength
                      </label>

                      <strong>
                        {strength.toFixed(2)}
                      </strong>
                    </div>

                    <input
                      id="strength"
                      type="range"
                      min="0.01"
                      max="1"
                      step="0.01"
                      value={strength}
                      onChange={(event) =>
                        setStrength(
                          Number(event.target.value)
                        )
                      }
                    />

                    <div className="range-labels">
                      <span>Subtle</span>
                      <span>Balanced</span>
                      <span>Strong</span>
                    </div>
                  </div>

                  <div className="setting-group">
                    <label htmlFor="secret-key">
                      Secret Key
                    </label>

                    <div className="secret-input">
                      <input
                        id="secret-key"
                        type={
                          showSecretKey
                            ? "text"
                            : "password"
                        }
                        value={secretKey}
                        placeholder="Enter secret key"
                        onChange={(event) =>
                          setSecretKey(
                            event.target.value
                          )
                        }
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowSecretKey(
                            (current) => !current
                          )
                        }
                      >
                        {showSecretKey ? "Hide" : "Show"}
                      </button>
                    </div>

                    <small className="input-help">
                      Minimum 4 characters. Keep this key
                      safe for extraction.
                    </small>
                  </div>

                  <div className="security-note">
                    <span>🔒</span>

                    <div>
                      <strong>
                        Secure embedding
                      </strong>

                      <p>
                        The secret key is required to
                        correctly extract the watermark.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="action-row">
                <button
                  type="button"
                  className="primary-action"
                  disabled={
                    processing ||
                    !originalFile ||
                    !watermarkFile ||
                    !secretKey.trim()
                  }
                  onClick={handleEmbed}
                >
                  {processing ? (
                    <>
                      <span className="button-spinner" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <span>⚡</span>
                      Embed Watermark
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="secondary-action"
                  disabled={
                    processing ||
                    !originalFile ||
                    !watermarkedBlob ||
                    !secretKey.trim()
                  }
                  onClick={handleExtract}
                >
                  {extracting ? (
                    <>
                      <span className="button-spinner" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <span>◉</span>
                      Extract Watermark
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="ghost-action"
                  onClick={handleReset}
                  disabled={processing || extracting}
                >
                  Reset
                </button>
              </div>
            </section>

            {(watermarkedPreview ||
              extractedPreview ||
              metrics) && (
              <section className="results-section">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">
                      Processing Results
                    </span>

                    <h2>
                      Watermarked Output
                    </h2>

                    <p>
                      Review the generated image and
                      extracted watermark.
                    </p>
                  </div>
                </div>

                <div className="result-grid">
                  <div className="result-image-card">
                    <div className="result-card-heading">
                      <div>
                        <span>
                          WATERMARKED IMAGE
                        </span>

                        <h3>
                          Protected Image
                        </h3>
                      </div>

                      {watermarkedBlob && (
                        <button
                          type="button"
                          className="download-button"
                          onClick={() =>
                            downloadBlob(
                              watermarkedBlob,
                              "watermarked.png"
                            )
                          }
                        >
                          ↓ Download
                        </button>
                      )}
                    </div>

                    <div className="result-image-container">
                      {watermarkedPreview ? (
                        <img
                          src={watermarkedPreview}
                          alt="Watermarked result"
                        />
                      ) : (
                        <div className="image-placeholder">
                          No output yet
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="result-image-card">
                    <div className="result-card-heading">
                      <div>
                        <span>
                          EXTRACTED WATERMARK
                        </span>

                        <h3>
                          Recovered Watermark
                        </h3>
                      </div>

                      {extractedBlob && (
                        <button
                          type="button"
                          className="download-button"
                          onClick={() =>
                            downloadBlob(
                              extractedBlob,
                              "extracted.png"
                            )
                          }
                        >
                          ↓ Download
                        </button>
                      )}
                    </div>

                    <div className="result-image-container">
                      {extractedPreview ? (
                        <img
                          src={extractedPreview}
                          alt="Extracted watermark"
                        />
                      ) : (
                        <div className="image-placeholder">
                          No extraction yet
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {metrics && (
                  <div className="metrics-grid">
                    {renderMetricCard(
                      "PSNR",
                      metrics.PSNR_dB,
                      " dB",
                      "Higher is better"
                    )}

                    {renderMetricCard(
                      "SSIM",
                      metrics.SSIM,
                      "",
                      "Closer to 1 is better"
                    )}

                    {renderMetricCard(
                      "NC",
                      metrics.NC,
                      "",
                      "Closer to 1 is better"
                    )}

                    {renderMetricCard(
                      "BER",
                      metrics.BER,
                      "",
                      "Lower is better"
                    )}
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {activeTab === "laboratory" && (
          <section className="laboratory-section">
            <div className="section-heading">
              <div>
                <span className="section-kicker">
                  Algorithm Laboratory
                </span>

                <h2>
                  Compare Watermarking Algorithms
                </h2>

                <p>
                  Run the same input through DCT, DWT, and
                  Hybrid DCT–DWT to compare performance.
                </p>
              </div>
            </div>

            <div className="lab-control-card">
              <div className="lab-upload-grid">
                <div className="lab-file-control">
                  <label>
                    Original Image
                  </label>

                  <button
                    type="button"
                    className="file-select-button"
                    onClick={() =>
                      originalInputRef.current?.click()
                    }
                  >
                    {originalFile
                      ? `✓ ${originalFile.name}`
                      : "Choose image"}
                  </button>
                </div>

                <div className="lab-file-control">
                  <label>
                    Watermark
                  </label>

                  <button
                    type="button"
                    className="file-select-button"
                    onClick={() =>
                      watermarkInputRef.current?.click()
                    }
                  >
                    {watermarkFile
                      ? `✓ ${watermarkFile.name}`
                      : "Choose watermark"}
                  </button>
                </div>

                <div className="lab-file-control">
                  <label htmlFor="lab-strength">
                    Alpha
                  </label>

                  <input
                    id="lab-strength"
                    type="number"
                    min="0.01"
                    max="1"
                    step="0.01"
                    value={strength}
                    onChange={(event) =>
                      setStrength(
                        Number(event.target.value)
                      )
                    }
                  />
                </div>

                <div className="lab-file-control">
                  <label>
                    Secret Key
                  </label>

                  <input
                    type="password"
                    value={secretKey}
                    placeholder="Secret key"
                    onChange={(event) =>
                      setSecretKey(event.target.value)
                    }
                  />
                </div>
              </div>

              <button
                type="button"
                className="primary-action lab-run-button"
                disabled={
                  comparisonLoading ||
                  !originalFile ||
                  !watermarkFile ||
                  !secretKey.trim()
                }
                onClick={handleComparison}
              >
                {comparisonLoading ? (
                  <>
                    <span className="button-spinner" />
                    Running comparison...
                  </>
                ) : (
                  <>
                    <span>◈</span>
                    Run Algorithm Comparison
                  </>
                )}
              </button>
            </div>

            {renderComparisonTable()}
          </section>
        )}

        {activeTab === "robustness" && (
          <section className="robustness-section">
            <div className="section-heading">
              <div>
                <span className="section-kicker">
                  Robustness Laboratory
                </span>

                <h2>
                  Attack Simulation
                </h2>

                <p>
                  Apply ten different attacks and measure
                  how well the watermark survives.
                </p>
              </div>
            </div>

            <div className="robustness-control-card">
              <div className="lab-upload-grid">
                <div className="lab-file-control">
                  <label>
                    Original Image
                  </label>

                  <button
                    type="button"
                    className="file-select-button"
                    onClick={() =>
                      originalInputRef.current?.click()
                    }
                  >
                    {originalFile
                      ? `✓ ${originalFile.name}`
                      : "Choose image"}
                  </button>
                </div>

                <div className="lab-file-control">
                  <label>
                    Watermarked Image
                  </label>

                  <button
                    type="button"
                    className="file-select-button"
                    onClick={() =>
                      watermarkedInputRef.current?.click()
                    }
                  >
                    {watermarkedFile
                      ? `✓ ${watermarkedFile.name}`
                      : "Choose watermarked image"}
                  </button>

                  <input
                    ref={watermarkedInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(event) =>
                      handleWatermarkedFile(
                        event.target.files?.[0] || null
                      )
                    }
                  />
                </div>

                <div className="lab-file-control">
                  <label>
                    Original Watermark
                  </label>

                  <button
                    type="button"
                    className="file-select-button"
                    onClick={() =>
                      watermarkInputRef.current?.click()
                    }
                  >
                    {watermarkFile
                      ? `✓ ${watermarkFile.name}`
                      : "Choose watermark"}
                  </button>
                </div>

                <div className="lab-file-control">
                  <label>
                    Secret Key
                  </label>

                  <input
                    type="password"
                    value={secretKey}
                    placeholder="Secret key"
                    onChange={(event) =>
                      setSecretKey(event.target.value)
                    }
                  />
                </div>
              </div>

              <div className="robustness-strength">
                <label htmlFor="robustness-alpha">
                  Embedding Strength
                </label>

                <input
                  id="robustness-alpha"
                  type="number"
                  min="0.01"
                  max="1"
                  step="0.01"
                  value={strength}
                  onChange={(event) =>
                    setStrength(
                      Number(event.target.value)
                    )
                  }
                />
              </div>

              <button
                type="button"
                className="primary-action lab-run-button"
                disabled={
                  robustnessLoading ||
                  !originalFile ||
                  !watermarkedFile ||
                  !watermarkFile ||
                  !secretKey.trim()
                }
                onClick={handleRobustnessTest}
              >
                {robustnessLoading ? (
                  <>
                    <span className="button-spinner" />
                    Testing attacks...
                  </>
                ) : (
                  <>
                    <span>⚔</span>
                    Run Robustness Test
                  </>
                )}
              </button>
            </div>

            {renderRobustnessResults()}
          </section>
        )}

        {activeTab === "history" && renderHistory()}
      </main>

      <footer className="footer">
        <div className="footer-brand">
          <div className="brand-mark small">
            HV
          </div>

          <div>
            <strong>
              HybridVault
            </strong>

            <span>
              Secure image watermarking laboratory
            </span>
          </div>
        </div>

        <div className="footer-info">
          <span>
            DCT + DWT + Secret-Key Protection
          </span>

          <span>
            •
          </span>

          <span>
            PSNR / SSIM / NC / BER
          </span>
        </div>

        <div className="footer-copy">
          © 2026 HybridVault
        </div>
      </footer>
    </div>
  );
}

export default App;