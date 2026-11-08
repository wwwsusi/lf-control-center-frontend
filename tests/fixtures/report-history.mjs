export function historyFixture(){
 const keys=['visits','membership','single','multisport','new_visitors','pass_units','product_units','training_units','zumba_hours','recorded_sales','report_value','sheet_price_value','product_cost','product_profit','multisport_receivable','change_pct'];
 return {schema_version:1,source:'Lady Fitness Reporting MVP · weekly aggregate query',generated_at:'2026-11-01',source_sha256:'a'.repeat(64),snapshot_period:{weeks:[40,41,42,43,44]},limitations:{scope:'synthetic',costs:'synthetic',missing:'synthetic',receipts:'synthetic'},weekly:[40,41,42,43,44].map(week=>({...Object.fromEntries(keys.map(k=>[k,k==='visits'?10:0])),week,period_start:week===43?'2026-10-19':null,period_end:week===43?'2026-10-25':null}))};
}
