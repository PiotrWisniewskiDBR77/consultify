# sha256 dowodów — [A] Wpis 15 zadanie 2 (2026-09-17)

Do repo wchodzą stąd wyłącznie pliki `.md`: katalogi `logs` wyklucza główny `.gitignore` (linia 2),
a `*.txt`/`*.json` wyklucza `evidence/.gitignore`. Logi runnerów, raporty crasha macOS (`.ips`) i źródła
sond (`*.txt`) zostają więc NA DYSKU, w worktree
`/Users/piotrwisniewski/Developer/qoder-wt/consultify-vitest-render/evidence/qoder-vitest-render-20260917/`
(ścieżki poniżej są względem tego katalogu) — ich sha256 i rozmiar są utrwalone tutaj, zgodnie z regułą
dowodów (Wpis 9 pkt 1 / Wpis 12 pkt 4).

```
9aadf1dd25ce7336e23641da8f88511bf76750f9508afa545dd677315dd66767  12K  DIAGNOZA.md
de62fbfbbf6c253c9b66b34adfdd9dc5428285912b1ebfa22f2db80aeb5b97fd  64K  logs/crash-sigsegv-node-2026-09-16-234700.ips
5eb254a9317a285ed1bd52d5152e3e814e62a9a23db8989e8f410527a85eebad  64K  logs/crash-sigtrap-node-2026-09-16-234246.ips
8cb066fbb1da73e4987c3e578e6ea39bc99a5c2f1a32d3d7b850998a2faeb58d  4.0K  logs/qoder-a-bisect-1.log
5895ce0f5d1f33db5dd0a8ced4e952307ea378d3577d9bb20bc8abd7c6a470fe  4.0K  logs/qoder-a-bisect-2.log
c49d287d1940385471f73f819436164ea72130132e441be614e4c77876940181  4.0K  logs/qoder-a-cfgA-zzprobe14-bothskia-1.log
1fd0cba75274525e992bd9cfeec3466a094c7af7754efe886242ea81bf1e6f51  4.0K  logs/qoder-a-cfgA-zzprobe14-bothskia-2.log
cd8f569392020cfee56f3de2b25b5ac0b17c9f0b71b44db0fdc697a22ab99594  4.0K  logs/qoder-a-cfgA-zzprobe14-bothskia-3.log
3257d710f5a06fff8414a17616d5740dd490446ced162ad05bbeb0e64535a887  4.0K  logs/qoder-a-cfgA-zzprobe15-pdfparseonly-1.log
751286b6442ecae26622a7f1e1a1952799c473fa239099df3ddbf3483ed71d9c  4.0K  logs/qoder-a-cfgA-zzprobe15-pdfparseonly-2.log
9724d8b80f3f582c0253894105aa523235196b3aad5656c2dab500c47560a42f  4.0K  logs/qoder-a-cfgA-zzprobe15-pdfparseonly-3.log
bdb6619403ce7ac1250607b65b74f2f3a6252623f2a5156db15c6a0f9ffd7883  4.0K  logs/qoder-a-cfgA-zzprobe16-chartonly-importpdfparse-1.log
1024ecdf02502a8ee62a346bdc604c9ae1152cc1a38cfa6bbbbf4d54edb5c386  4.0K  logs/qoder-a-cfgA-zzprobe16-chartonly-importpdfparse-2.log
c9c630a075629be8c1f3f98851e21a7f19c40125d2810a1baef525dff88632ba  4.0K  logs/qoder-a-cfgA-zzprobe16-chartonly-importpdfparse-3.log
a53391086b0435f47b1766f01a5a8a5a13e6f347284d9b950214be1d02bf5ec0  8.0K  logs/qoder-a-cfgA2-probe15.log
de835a24d0ca7f55421148c0822458135ee042ca5952870d37f88db41fed5ace  8.0K  logs/qoder-a-cfgA2-zzprobe14-bothskia-1.log
dd93c6af62792069d2113b30cf396eed5c9118f6cd7015c056ad48fe6bd2f7ce  8.0K  logs/qoder-a-cfgA2-zzprobe14-bothskia-2.log
dc311679fd331b96f01c200be2b9ac25747435c6cbf67c8111e4be0617c1d66b  8.0K  logs/qoder-a-cfgA2-zzprobe14-bothskia-3.log
00296477d6a43cd38532ff4826410d521965322853c4714f98452c0e2af4429c  8.0K  logs/qoder-a-cfgA2-zzprobe16-chartonly-importpdfparse-1.log
c43990c055ac0c2040cfd230b0e9abc494d36a4e06ac7357b9c642690ba13030  8.0K  logs/qoder-a-cfgA2-zzprobe16-chartonly-importpdfparse-2.log
ca16fbd86c43c7e34a7c1fc40d6d4c733f66a19e73dd0f9710b86452a5c6370d  8.0K  logs/qoder-a-cfgA2-zzprobe16-chartonly-importpdfparse-3.log
5ad58db712c40c0054a7540d9e4f31cdb075241e25485c59858627722b37f794  8.0K  logs/qoder-a-g1-A2-1.log
6233012cda8ce9dce95d4ca5e59ac7a19e786ac231a656d5da7ca6581bba8ca5  8.0K  logs/qoder-a-g1-A2-2.log
ca0c184284ba3256af27df619dd21964326305c843e11158b29d32cd0fde8ee9  8.0K  logs/qoder-a-g1-A2-3.log
bc5a7cabedd6d520b6e28baa85af001816dca96a1e541ec1832db9d0e9709522  4.0K  logs/qoder-a-g1-H-1.log
79f378b101f107a00868cf55070b2a9d1c51b28f930d806d9ba2cf870faf5a48  4.0K  logs/qoder-a-g1-H-2.log
cdcdb40492e144a0b895571f12510744fbbb1fba7a76d067b7532d7dd1f273b7  4.0K  logs/qoder-a-g1-H-3.log
2146a7cb4ac9b207c94724e53375253814d30e2cfca01d2d040a6de533a02218  4.0K  logs/qoder-a-g1-default-1.log
6be5c22b650363fd7e1c312c89f66e7a8a1409eb968378773338a8f133b0fe31  4.0K  logs/qoder-a-g1-default-2.log
0111fdb3a3e7b658441d4b2df22c606b28e5c09629613e33292d2749d2c88a62  4.0K  logs/qoder-a-g1-default-3.log
f7420bcaa5706403b1a6fba9d992f00205aa0b08460d775cda978b7ccec8f231  4.0K  logs/qoder-a-g1-default.log
4f0e3c574333b2dee98579855e9a30c8837a617d320d53b3652e0cfe5be51a55  4.0K  logs/qoder-a-g1-forks-1.log
fab00ae4b66d31f3c43339f45df547720a694b2e7baa08a28c505666ae4e1211  4.0K  logs/qoder-a-g1-forks-2.log
9d8c234236b328f157b75fd51d86c889a44d302659ac6008b5b0ed84eb9fe09e  4.0K  logs/qoder-a-g1-forks-3.log
de2a0901d2e18007cbc6b96821f65b245b5c9e48c54480248413fa668265a879  4.0K  logs/qoder-a-g1-pool-forks.log
d3596e78b3b70fff9100f635adaf939d6e622da5eaddafa8c8375820ed8c5985  4.0K  logs/qoder-a-g1-pool-threads.log
74513ac37ab0d95b12443305395bf6322d155736261036a795bf001d6f476b4f  4.0K  logs/qoder-a-probe11-1.log
6bc51f83957be3d4ecea5304293b263786c1adf9be9dd9a86f43666f73bf5c49  4.0K  logs/qoder-a-probe11-2.log
daf65e6bd944351671156c677c03c10a0fa8aaa094e0d2a7555eb5cdbb30d3b1  4.0K  logs/qoder-a-probe11-3.log
97c869c988429c39fe9ca4f4036cb2894269d532e003759d4858b0f49e8cd76e  4.0K  logs/qoder-a-probe12.log
96e7e8e9f131e04807f14fe54759677df4f847f26ccfc9f0d5abec54c6b9997a  4.0K  logs/qoder-a-probe13.log
ca28235af64761290dba2bc86759d00ce782af58214895c56eac7ec3c3c4ee92  4.0K  logs/qoder-a-probe17-H2.log
28897c14630c45c58ef7f4a4af7796312e39bd86ee78982fed615c830b52fc25  4.0K  logs/qoder-a-probe17-H3.log
76dab7a9e87e1f5b87c25809bf5ac50cc194d4d9a9823eec9412d81b0cd4ae30  4.0K  logs/qoder-a-probe17-base.log
3315d87eb63ee57c8ca1e45a7d48d431ccd137f7d27e8cc7c547d05c3b820ebd  8.0K  logs/qoder-a-probe17-cfgA.log
520541315875275b79f1a29aeaf99ce6f652ef9ce4987defc21a317072464039  4.0K  logs/qoder-a-probe20.log
5e20aca4affa7a78ad8e5a7a0ba77ad8dc5f3030925e67c20517639669bb0820  4.0K  logs/qoder-a-probe21-H.log
6cfcfd91c1b3039f5fed3e9a947e1095d05fe8ee4c49f67b4649140c281c2017  4.0K  logs/qoder-a-probe21.log
9f3b84c717e7fbd446a9cee53dd3540f62f561ea1d7b2ed8c11302a51a8d7889  4.0K  logs/qoder-a-probe22-1.log
1c1a87ee177b67b6802963d9f54a3bcd8741f49deb3b52a0cbd0aab7886d3036  4.0K  logs/qoder-a-probe22-2.log
bc8e4b4d4bc7205ab08e6562a633a910f7d819b1f17acf1743482921ed4d00ba  4.0K  logs/qoder-a-probe22-3.log
5e99f2cd17513f4c6070b0738a26c3404a6a78c475cf09023edd94c36a6c2fe4  4.0K  logs/qoder-a-zzprobe1-baseline.log
09f87a11d22f077f150903e50e3ec57fd2e5d1a3256ab340de3b1636ec4da82f  4.0K  logs/qoder-a-zzprobe10-pdfparse.log
e3263d34c68093cf2f5fda376b0ff560557c91ce08bf7cdf56c75dea2374fe7e  4.0K  logs/qoder-a-zzprobe14-bothskia-1.log
6cd59b25431777e79f4b1532196c7a9e85d0bc47580c18c59014fbfe3acd833d  4.0K  logs/qoder-a-zzprobe14-bothskia-2.log
a1ced536588b61d5ced1c1c2de05996affde7a7f24801f25e8af2e264beb0f7f  4.0K  logs/qoder-a-zzprobe14-bothskia-3.log
8893b90018e3a74b8628ea2fa4602b3717d7ae8d74bb6992568f3e7dd2b4c932  4.0K  logs/qoder-a-zzprobe15-pdfparseonly-1.log
5c3b451d504c94e09aebd46170741e1008a89058cdf30562c204af12e3ccb8f7  4.0K  logs/qoder-a-zzprobe15-pdfparseonly-2.log
6b7ca05ef0a82c4d5f11f26f40a9a83d80c05df4b6f43b19a6c56dfb6648b441  4.0K  logs/qoder-a-zzprobe15-pdfparseonly-3.log
11286956807738d506f9192e7bedf77ba4eaf03e78375085cd713a8f24580f95  4.0K  logs/qoder-a-zzprobe16-chartonly-importpdfparse-1.log
290ed54702517dbe3227aad6f83146648e29822b262fb9b74e2b86e7fdf640bf  4.0K  logs/qoder-a-zzprobe16-chartonly-importpdfparse-2.log
c483ad566ac7f5263aae8c0b66e7a3f124a7362a99a5007cb100ba751550e050  4.0K  logs/qoder-a-zzprobe16-chartonly-importpdfparse-3.log
762401fa53a8b617ffe2dfec1e92f6bd4132bfe19a740eda220ac86bf901d89e  4.0K  logs/qoder-a-zzprobe2-jszip.log
db8ce8c7ccc582d698b8d04ac23278f336824dadcc787b684ef108467a72abab  4.0K  logs/qoder-a-zzprobe3-pdfparse.log
a4aa8480149399b2b7af15ac98ee4e6ee8c815355d210ce1bdea0097515031ef  4.0K  logs/qoder-a-zzprobe4-docxrenderer.log
4472297d7f7fd2b6d83d8dcfdf0f6a875338bb5413f263d8d2b591d7fbd26160  4.0K  logs/qoder-a-zzprobe5-pptxrenderer.log
10790b4dc60ae234d428d1b99845cf75ee1707a288f9e829bc5d4c32c38ab133  4.0K  logs/qoder-a-zzprobe6-pdfrenderer.log
472cfd5a6e75f49d7af4d14d3e7f92cbc4a3d9a086c4da2c63c47bdc5b24ba4c  4.0K  logs/qoder-a-zzprobe7-docxrender.log
8c5a7e95760bf1464aa40cd5f3be1ebfe7e9e7530dadb4f8cb93f4a07d0cbda8  4.0K  logs/qoder-a-zzprobe8-pptxrender.log
7c5202afa563214d686273e80719bfc6ffbdab644657167ab2814ddda49ad45f  4.0K  logs/qoder-a-zzprobe9-pdfrender.log
c1522429cb6eb4fd6ce2607a75b50f25f79803666ee7ee13bf2b423a78b22d51  4.0K  minimal-repro.test.txt
b66ce4d4ad38eadb16f7f9be8f418037b46ac45e84a69a43cf4279849e5ae3ee  4.0K  tsx-dual-repro.mts.txt
```
