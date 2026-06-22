function calculateLoan() {
  const carPrice = parseFloat(document.getElementById("car-price").value);
  const downPayment = parseFloat(document.getElementById("down-payment").value);
  const annualInterestRate = parseFloat(
    document.getElementById("interest-rate").value,
  );
  const loanTermMonths = parseInt(document.getElementById("loan-term").value);

  // Calculate Principal Loan Amount
  const principal = carPrice - downPayment;

  if (principal <= 0) {
    document.getElementById("monthly-payment").innerText = "$0.00";
    return;
  }

  // Convert annual interest rate to monthly decimal
  const monthlyInterest = annualInterestRate / 100 / 12;

  // If interest rate is 0%
  let monthlyPayment;
  if (monthlyInterest === 0) {
    monthlyPayment = principal / loanTermMonths;
  } else {
    // Amortization formula
    monthlyPayment =
      (principal *
        (monthlyInterest * Math.pow(1 + monthlyInterest, loanTermMonths))) /
      (Math.pow(1 + monthlyInterest, loanTermMonths) - 1);
  }

  // Display result formatted as currency
  document.getElementById("monthly-payment").innerText =
    `$${monthlyPayment.toFixed(2)}`;
}

// Run the calculation once on load to populate initial values
window.onload = calculateLoan;
