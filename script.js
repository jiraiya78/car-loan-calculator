// Global Chart and Comparison Instances
let lossChartInstance = null;
let yearlyLossChartInstance = null;
let savedComparisons = [];
let scenarioCounter = 1; // Auto-incrementing index tracker for unique labels

// Helper Function: Format numbers with thousands commas
function formatMYR(num) {
  return (
    "RM " +
    (num || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

// Tab Switching System
function switchTab(tabName) {
  document
    .querySelectorAll(".tab-content")
    .forEach((el) => el.classList.remove("active"));
  document
    .querySelectorAll(".tab-btn")
    .forEach((el) => el.classList.remove("active"));

  const targetTab = document.getElementById(`${tabName}-tab`);
  if (targetTab) targetTab.classList.add("active");

  const targetBtn = Array.from(document.querySelectorAll(".tab-btn")).find(
    (b) =>
      b.getAttribute("onclick") && b.getAttribute("onclick").includes(tabName),
  );
  if (targetBtn) targetBtn.classList.add("active");

  if (tabName === "analysis") {
    calculateAll();
  } else if (tabName === "target") {
    calculateTarget();
  } else if (tabName === "comparison") {
    renderComparisonTable();
  }
}

// Dynamically generate early selling choices limited by maximum tenure length
function updateSellEarlyOptions() {
  const loanTermEl = document.getElementById("loan-term");
  const sellEarlySelect = document.getElementById("sell-early");
  if (!loanTermEl || !sellEarlySelect) return;

  const totalTermMonths = parseInt(loanTermEl.value) || 84;
  const maxYears = totalTermMonths / 12;

  const currentSelection = sellEarlySelect.value || "no";
  sellEarlySelect.innerHTML =
    '<option value="no">No, keep until loan ends</option>';

  for (let y = 1; y <= 11; y++) {
    if (y < maxYears) {
      const opt = document.createElement("option");
      opt.value = y;
      opt.innerText = `Yes, sell after ${y} Years`;
      sellEarlySelect.appendChild(opt);
    }
  }

  if (parseInt(currentSelection) < maxYears) {
    sellEarlySelect.value = currentSelection;
  } else {
    sellEarlySelect.value = "no";
  }
}

// BANK NEGARA MALAYSIA COMPLIANT INTEREST ENGINE (Flat Rate Base for Hire Purchase)
function getMonthlyInstalment(principal, annualRatePct, months) {
  const flatAnnualInterest = principal * (annualRatePct / 100);
  const totalInterestOverTenure = flatAnnualInterest * (months / 12);
  return (principal + totalInterestOverTenure) / months;
}

// Toggle layout components contextually
function handleConditionChange() {
  const condEl = document.getElementById("car-condition");
  if (!condEl) return;

  const condition = condEl.value;
  const usedOptionsWrapper = document.getElementById("used-options-wrapper");
  const usedCarNotes = document.getElementById("used-car-notes");
  const priceInputLabel = document.getElementById("price-input-label");
  const carPriceEl = document.getElementById("car-price");
  const usedListPriceEl = document.getElementById("used-list-price");
  const interestRateEl = document.getElementById("interest-rate");

  if (condition === "used") {
    if (usedOptionsWrapper) usedOptionsWrapper.style.display = "block";
    if (usedCarNotes) usedCarNotes.style.display = "block";
    if (priceInputLabel)
      priceInputLabel.innerText = "Used Car Purchase Price (RM)";
    if (interestRateEl) interestRateEl.value = "4.2"; // Used Car Default

    if (usedListPriceEl && carPriceEl) {
      carPriceEl.value = usedListPriceEl.value;
    }
  } else {
    if (usedOptionsWrapper) usedOptionsWrapper.style.display = "none";
    if (usedCarNotes) usedCarNotes.style.display = "none";
    if (priceInputLabel) priceInputLabel.innerText = "Car Showroom Price (RM)";
    if (interestRateEl) interestRateEl.value = "3.4"; // New Car Default
  }
  calculateAll();
}

// Core Math Computation Engine - FIXED FORMULAS
function runCalculationCore() {
  const condEl = document.getElementById("car-condition");
  if (!condEl) return null;

  const condition = condEl.value;
  let carPrice = parseFloat(document.getElementById("car-price").value) || 0;
  const downPayment =
    parseFloat(document.getElementById("down-payment").value) || 0;
  const rateInput =
    parseFloat(document.getElementById("interest-rate").value) || 0;
  const totalTermMonths =
    parseInt(document.getElementById("loan-term").value) || 84;
  const sellEarlyOpt = document.getElementById("sell-early")
    ? document.getElementById("sell-early").value
    : "no";
  const loanRuleType = document.getElementById("loan-rule")
    ? document.getElementById("loan-rule").value
    : "new";

  if (condition === "used" && document.getElementById("used-list-price")) {
    carPrice =
      parseFloat(document.getElementById("used-list-price").value) || 60000;
  }

  const principal = carPrice - downPayment;
  if (principal <= 0 || carPrice <= 0) return null;

  const monthlyPayment = getMonthlyInstalment(
    principal,
    rateInput,
    totalTermMonths,
  );
  const baselineTotalInterest =
    principal * (rateInput / 100) * (totalTermMonths / 12);

  const isEarlySale = sellEarlyOpt !== "no";
  const analysisYears = isEarlySale
    ? parseInt(sellEarlyOpt)
    : totalTermMonths / 12;
  const analysisMonths = analysisYears * 12;

  const totalPaidToDate = downPayment + monthlyPayment * analysisMonths;

  const remainingInstallments = totalTermMonths - analysisMonths;
  let remainingLoanBalance = 0;

  if (remainingInstallments > 0) {
    if (loanRuleType === "old") {
      const sumTotal = (totalTermMonths * (totalTermMonths + 1)) / 2;
      const sumRemaining =
        (remainingInstallments * (remainingInstallments + 1)) / 2;
      const interestRebate = (sumRemaining / sumTotal) * baselineTotalInterest;
      remainingLoanBalance =
        monthlyPayment * remainingInstallments - interestRebate;
    } else {
      const averageInterestPerMonth = baselineTotalInterest / totalTermMonths;
      remainingLoanBalance =
        monthlyPayment * remainingInstallments -
        averageInterestPerMonth * remainingInstallments * 0.15;
    }
  } else {
    remainingLoanBalance = 0;
  }

  let finalCarValue = 0;
  let originalNewPrice = carPrice;

  if (condition === "used") {
    const carAge = parseInt(document.getElementById("car-age").value) || 5;
    if (carAge === 2) {
      originalNewPrice = carPrice / (0.8 * 0.88);
    } else if (carAge <= 5) {
      originalNewPrice = carPrice / (0.8 * Math.pow(0.88, carAge - 1));
    } else {
      originalNewPrice =
        carPrice / (0.8 * Math.pow(0.88, 4) * Math.pow(0.93, carAge - 5));
    }
    finalCarValue = carPrice * Math.pow(1 - 0.08, analysisYears);
  } else {
    finalCarValue = carPrice * Math.pow(1 - 0.09, analysisYears);
  }

  const absoluteLoss = totalPaidToDate - (finalCarValue - remainingLoanBalance);

  return {
    condition,
    carPrice,
    downPayment,
    principal,
    rateInput,
    totalTermMonths,
    loanRuleType,
    monthlyPayment,
    analysisYears,
    analysisMonths,
    sellEarlyOpt,
    evaluationTotalOutflow: totalPaidToDate,
    finalCarValue,
    remainingLoanBalance,
    originalNewPrice,
    absoluteLoss,
  };
}

function safeSetText(id, text) {
  const el = document.getElementById(id);
  if (el) el.innerText = text;
}

function updateSmartInsight(data) {
  const container = document.getElementById("smart-insight-container");
  if (!container) return;

  if (data && data.condition === "used") {
    const originalPriceFormatted = Math.round(
      data.originalNewPrice,
    ).toLocaleString();
    container.innerHTML = `
      <div class="insight-box">
        🚀 <strong>Smart Segment Insight:</strong> At ${formatMYR(data.carPrice)}, you are purchasing a vehicle that originally commanded an investment of approx. <strong>RM ${originalPriceFormatted}</strong> when new.
        Instead of a basic brand-new B-segment model, this option scales you into a premium, structurally superior vehicle tier for the same out-of-pocket asset cost.
      </div>
    `;
  } else {
    container.innerHTML = "";
  }
}

function calculateAll() {
  const data = runCalculationCore();
  updateSmartInsight(data);

  if (!data) {
    safeSetText("res-monthly", "RM 0.00");
    safeSetText("res-total-paid", "RM 0.00");
    safeSetText("res-car-value", "RM 0.00");
    const lossEl = document.getElementById("res-total-loss");
    if (lossEl) lossEl.innerText = "RM 0.00";
    return;
  }

  const labelTotalPaid = document.getElementById("label-total-paid");
  const labelCarValue = document.getElementById("label-car-value");

  if (labelTotalPaid) {
    labelTotalPaid.innerText =
      data.sellEarlyOpt !== "no"
        ? `Total Paid up to Year ${data.analysisYears}`
        : "Total Paid over Tenure";
  }
  if (labelCarValue) {
    labelCarValue.innerText = `Car Value vs Balance Principal (Yr ${data.analysisYears})`;
  }

  safeSetText("res-monthly", formatMYR(data.monthlyPayment));
  safeSetText("res-total-paid", formatMYR(data.evaluationTotalOutflow));

  const carValueEl = document.getElementById("res-car-value");
  if (carValueEl) {
    carValueEl.innerHTML = `
            <div style="font-size: 20px;">${formatMYR(data.finalCarValue)}</div>
            <div style="font-size: 12px; font-weight: normal; color: #94a3b8; margin-top: 2px;">Owed: ${formatMYR(data.remainingLoanBalance)}</div>
        `;
  }

  const totalLossEl = document.getElementById("res-total-loss");
  if (totalLossEl) {
    totalLossEl.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 5px;">${formatMYR(data.absoluteLoss)}</div>
            <div style="font-size: 13px; font-weight: normal; color: #fca5a5;">📉 ~${formatMYR(data.absoluteLoss / data.analysisYears)} / year</div>
            <div style="font-size: 13px; font-weight: normal; color: #fca5a5;">📉 ~${formatMYR(data.absoluteLoss / data.analysisMonths)} / month</div>
        `;
  }

  const chartPoints = calculateYearlyDataPoints(
    data.carPrice,
    data.downPayment,
    data.rateInput,
    data.totalTermMonths,
    data.loanRuleType,
    data.condition,
  );
  renderLineChart(chartPoints);

  const periodicLossData = calculateAnnualizedLossMatrix(
    data.carPrice,
    data.downPayment,
    data.rateInput,
    data.totalTermMonths,
    data.loanRuleType,
    data.condition,
  );
  renderYearlyLossBarChart(periodicLossData);
}

function calculateYearlyDataPoints(
  carPrice,
  downPayment,
  rateInput,
  totalTermMonths,
  loanRuleType,
  condition,
) {
  const maxYears = totalTermMonths / 12;
  const principal = carPrice - downPayment;
  let data = { labels: [], payments: [], values: [] };

  const monthlyPayment = getMonthlyInstalment(
    principal,
    rateInput,
    totalTermMonths,
  );

  data.labels.push("Year 0");
  data.payments.push(downPayment);
  data.values.push(carPrice);

  for (let y = 1; y <= maxYears; y++) {
    data.labels.push(`Year ${y}`);
    const currentMonths = y * 12;
    const totalPaidToDate = downPayment + monthlyPayment * currentMonths;

    let currentCarValue =
      condition === "used"
        ? carPrice * Math.pow(1 - 0.08, y)
        : carPrice * Math.pow(1 - 0.09, y);
    data.payments.push(totalPaidToDate);
    data.values.push(currentCarValue);
  }
  return data;
}

function calculateAnnualizedLossMatrix(
  carPrice,
  downPayment,
  rateInput,
  totalTermMonths,
  loanRuleType,
  condition,
) {
  const maxYears = totalTermMonths / 12;
  const principal = carPrice - downPayment;
  let matrix = { labels: [], annualizedLosses: [] };

  const monthlyPayment = getMonthlyInstalment(
    principal,
    rateInput,
    totalTermMonths,
  );
  const baselineTotalInterest =
    principal * (rateInput / 100) * (totalTermMonths / 12);

  for (let y = 1; y <= maxYears; y++) {
    matrix.labels.push(`Hold ${y} Yrs`);
    const currentMonths = y * 12;
    const totalPaidToDate = downPayment + monthlyPayment * currentMonths;

    const remainingInstallments = totalTermMonths - currentMonths;
    let remainingLoanBalance = 0;
    if (remainingInstallments > 0) {
      if (loanRuleType === "old") {
        const sumTotal = (totalTermMonths * (totalTermMonths + 1)) / 2;
        const sumRemaining =
          (remainingInstallments * (remainingInstallments + 1)) / 2;
        const interestRebate =
          (sumRemaining / sumTotal) * baselineTotalInterest;
        remainingLoanBalance =
          monthlyPayment * remainingInstallments - interestRebate;
      } else {
        const averageInterestPerMonth = baselineTotalInterest / totalTermMonths;
        remainingLoanBalance =
          monthlyPayment * remainingInstallments -
          averageInterestPerMonth * remainingInstallments * 0.15;
      }
    }

    let localCarValue =
      condition === "used"
        ? carPrice * Math.pow(1 - 0.08, y)
        : carPrice * Math.pow(1 - 0.09, y);
    let absoluteLoss = totalPaidToDate - (localCarValue - remainingLoanBalance);
    matrix.annualizedLosses.push(absoluteLoss / y);
  }
  return matrix;
}

function renderLineChart(chartPoints) {
  const canvas = document.getElementById("lossLineChart");
  if (!canvas || typeof Chart === "undefined") return;
  try {
    const ctx = canvas.getContext("2d");
    if (lossChartInstance !== null) lossChartInstance.destroy();

    lossChartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: chartPoints.labels,
        datasets: [
          {
            label: "Total Capital Outflow",
            data: chartPoints.payments,
            borderColor: "#38bdf8",
            backgroundColor: "rgba(56, 189, 248, 0.05)",
            tension: 0.2,
            fill: true,
          },
          {
            label: "Car Residual Value",
            data: chartPoints.values,
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.05)",
            tension: 0.2,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: "#94a3b8" } } },
        scales: {
          x: { grid: { color: "#334155" }, ticks: { color: "#94a3b8" } },
          y: { grid: { color: "#334155" }, ticks: { color: "#94a3b8" } },
        },
      },
    });
  } catch (e) {
    console.error(e);
  }
}

function renderYearlyLossBarChart(matrixData) {
  const canvas = document.getElementById("yearlyLossChart");
  if (!canvas || typeof Chart === "undefined") return;
  try {
    const ctx = canvas.getContext("2d");
    if (yearlyLossChartInstance !== null) yearlyLossChartInstance.destroy();

    yearlyLossChartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: matrixData.labels,
        datasets: [
          {
            label: "Average Realized Loss / Year",
            data: matrixData.annualizedLosses,
            backgroundColor: "rgba(244, 63, 94, 0.65)",
            borderColor: "#f43f5e",
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: "#94a3b8" } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: "#94a3b8" } },
          y: { grid: { color: "#334155" }, ticks: { color: "#94a3b8" } },
        },
      },
    });
  } catch (e) {
    console.error(e);
  }
}

function saveCurrentToComparison() {
  const currentData = runCalculationCore();
  if (!currentData) return;

  if (savedComparisons.length >= 3) {
    alert(
      "Comparison matrix is full! Please remove an existing scenario first.",
    );
    return;
  }

  const variantNameInput = prompt(
    "Enter a label for this configuration (e.g., 'Myvi New', 'Used Accord'):",
  );

  // Use sequential numbers that never shift backward or collide
  const variantName = variantNameInput
    ? variantNameInput.trim()
    : `Scenario ${scenarioCounter++}`;

  // If a custom label was specified, we still bump the global index to prevent future overlaps
  if (variantNameInput) {
    scenarioCounter++;
  }

  savedComparisons.push({
    id: Date.now(),
    label: variantName,
    ...currentData,
  });

  alert(`Successfully pinned "${variantName}" into comparisons!`);
  renderComparisonTable();
}

function removeComparisonSlot(id) {
  savedComparisons = savedComparisons.filter((item) => item.id !== id);
  renderComparisonTable();
}

function renderComparisonTable() {
  const container = document.getElementById("comparison-matrix-view");
  if (!container) return;

  if (savedComparisons.length === 0) {
    container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #64748b;">
                <p>No active variants are currently pinned for cross-examination.</p>
                <button class="tab-btn" style="background:#38bdf8; color:#0f172a; border:none; padding:10px 16px; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="switchTab('analysis')">Go to Simulation Panel</button>
            </div>
        `;
    return;
  }

  let html = `
        <table class="comparison-table" style="width:100%; border-collapse:collapse; margin-top:15px; font-size:13px; text-align:left;">
            <thead>
                <tr style="border-bottom:2px solid #334155; background:#1e293b;">
                    <th style="padding:12px; color:#94a3b8;">Cross Examination Parameters</th>
    `;

  savedComparisons.forEach((item) => {
    html += `
            <th style="padding:12px; min-width:140px; text-align:center;">
                <div style="font-weight:bold; color:#f8fafc; font-size:14px;">${item.label}</div>
                <button style="background:transparent; border:none; color:#f43f5e; cursor:pointer; font-size:11px; margin-top:4px; text-decoration:underline;" onclick="removeComparisonSlot(${item.id})">Remove Slot</button>
            </th>
        `;
  });

  for (let i = savedComparisons.length; i < 3; i++) {
    html += `<th style="padding:12px; color:#475569; text-align:center; font-style:italic;">Empty Slot</th>`;
  }
  html += `</tr></thead><tbody>`;

  const matrixRows = [
    {
      label: "Car Price / Total Loan",
      key: (item) =>
        `${formatMYR(item.carPrice)} / <span style="color:#94a3b8;">${formatMYR(item.principal)}</span>`,
    },
    {
      label: "Loan Rate & Tenure",
      key: (item) =>
        `${item.rateInput}% p.a. @ ${item.totalTermMonths / 12} Yrs (${item.totalTermMonths} mos)`,
    },
    {
      label: "Monthly Payment",
      key: (item) =>
        `<strong style="color:#38bdf8;">${formatMYR(item.monthlyPayment)}</strong>`,
    },
    {
      label: "Total Paid",
      key: (item) => `
                <div style="font-weight:bold;">${formatMYR(item.evaluationTotalOutflow)}</div>
                <div style="font-size:11px; color:#94a3b8;">(${item.sellEarlyOpt !== "no" ? `Sell after ${item.analysisYears} Yrs` : "Kept Over Full Tenure"})</div>
            `,
    },
    {
      label: "Car Value vs Balance Principal",
      key: (item) => `
                <div class="text-green" style="font-weight:bold;">Val: ${formatMYR(item.finalCarValue)}</div>
                <div style="font-size:11px; color:#94a3b8;">Owed: ${formatMYR(item.remainingLoanBalance)}</div>
                <div style="font-size:11px; color:#64748b; font-style:italic; margin-top:2px;">(At Year ${item.analysisYears})</div>
            `,
    },
    {
      label: "Net Ownership Loss + Yearly / Monthly",
      key: (item) => `
            <div style="font-weight:bold; color:#f43f5e;">${formatMYR(item.absoluteLoss)}</div>
            <div style="color:#fca5a5; font-size:11px;">📉 ~${formatMYR(item.absoluteLoss / item.analysisYears)} / Yr</div>
            <div style="color:#fca5a5; font-size:11px;">📉 ~${formatMYR(item.absoluteLoss / item.analysisMonths)} / Mo</div>
        `,
    },
  ];

  matrixRows.forEach((rowDef) => {
    html += `<tr style="border-bottom:1px solid #334155;">`;
    html += `<td style="padding:12px; font-weight:500; color:#94a3b8;">${rowDef.label}</td>`;

    savedComparisons.forEach((item) => {
      html += `<td style="padding:12px; text-align:center; background: rgba(30,41,59,0.3);">${rowDef.key(item)}</td>`;
    });

    for (let i = savedComparisons.length; i < 3; i++) {
      html += `<td style="background:transparent;"></td>`;
    }
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

function calculateTarget() {
  const targetMonthly =
    parseFloat(document.getElementById("target-monthly").value) || 0;
  const maxRate = parseFloat(document.getElementById("target-rate").value) || 0;
  const tableBody = document.getElementById("target-table-body");

  if (!tableBody) return;
  tableBody.innerHTML = "";
  if (targetMonthly <= 0) return;

  const terms = [48, 60, 72, 84, 96, 108];

  terms.forEach((months) => {
    const totalPrincipalInstallments = targetMonthly * months;
    const totalInterestFactor = 1 + (maxRate / 100) * (months / 12);
    const maxPrincipal = totalPrincipalInstallments / totalInterestFactor;

    const maxCarPrice = maxPrincipal / 0.9;
    const totalInterest = targetMonthly * months - maxPrincipal;

    // Explicit dynamic window boundaries for targeted search queries
    const roundedMaxPrice = Math.floor(maxCarPrice);
    // Ensure the floor calculation never drops below 0 if checking tight budgets
    const roundedMinPrice = Math.max(0, roundedMaxPrice - 10000);

    // Updated search link configuration containing matching price window bounds
    const targetCarlistUrl = `https://www.carlist.my/cars-for-sale/malaysia?min_price=${roundedMinPrice}&max_price=${roundedMaxPrice}`;

    const row = document.createElement("tr");
    row.innerHTML = `
            <td style="padding: 12px;"><strong>${months / 12} Years</strong> (${months} mos)</td>
            <td style="color:#10b981; font-weight:bold; padding: 12px;">${formatMYR(maxCarPrice)}</td>
            <td style="color:#ef4444; padding: 12px;">${formatMYR(totalInterest)}</td>
            <td style="padding: 12px;">
              <a href="${targetCarlistUrl}" target="_blank" rel="noopener noreferrer" class="btn-action">
                🔍 Find Cars
              </a>
            </td>
        `;
    tableBody.appendChild(row);
  });
}

function initApp() {
  const carConditionDropdown = document.getElementById("car-condition");
  if (carConditionDropdown) {
    carConditionDropdown.addEventListener("change", handleConditionChange);
  }

  const usedPriceSelect = document.getElementById("used-list-price");
  const usedAgeSelect = document.getElementById("car-age");
  if (usedPriceSelect)
    usedPriceSelect.addEventListener("change", () => {
      const cp = document.getElementById("car-price");
      if (cp) cp.value = usedPriceSelect.value;
      calculateAll();
    });
  if (usedAgeSelect) usedAgeSelect.addEventListener("change", calculateAll);

  const inputIds = [
    "car-price",
    "down-payment",
    "interest-rate",
    "loan-term",
    "sell-early",
    "loan-rule",
  ];
  inputIds.forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener("change", calculateAll);
      element.addEventListener("input", calculateAll);
    }
  });

  const loanTermInput = document.getElementById("loan-term");
  if (loanTermInput) {
    loanTermInput.addEventListener("change", () => {
      updateSellEarlyOptions();
      calculateAll();
    });
  }

  const targetInput = document.getElementById("target-monthly");
  const targetRateInput = document.getElementById("target-rate");
  if (targetInput) targetInput.addEventListener("input", calculateTarget);
  if (targetRateInput)
    targetRateInput.addEventListener("input", calculateTarget);

  handleConditionChange();
  updateSellEarlyOptions();
  calculateAll();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
