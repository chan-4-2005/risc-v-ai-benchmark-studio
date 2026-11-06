import { CATEGORIES, type CategoryKey } from "./paper-data";

export type ParamKey = "N" | "TILE" | "ACT" | "VL" | "STRIDE";
export type ParamValues = Partial<Record<ParamKey, string | number>>;

export const PARAM_DEFS: Record<ParamKey, { label: string; options: (string | number)[]; default: string | number; hint: string }> = {
  N: { label: "Dimension N", options: [64, 128, 256, 512, 1024], default: 256, hint: "Matrix side / tensor width / buffer length (×1024 for memory)" },
  TILE: { label: "Tile size", options: [8, 16, 32, 64, 128], default: 64, hint: "Cache-blocking tile (paper: LLVM emits 64×64 for L1)" },
  ACT: { label: "Activation", options: ["relu", "sigmoid", "tanh", "gelu"], default: "relu", hint: "Fused activation for dense/conv kernels" },
  VL: { label: "Vector length", options: [1024, 4096, 16384, 65536, 262144], default: 65536, hint: "Elements per vector operand" },
  STRIDE: { label: "Stride", options: [1, 2, 4, 8, 16, 64], default: 8, hint: "Element stride for strided access patterns" },
};

const CAT_PARAMS: Record<CategoryKey, ParamKey[]> = {
  matrix: ["N", "TILE"],
  neural: ["N", "ACT"],
  vector: ["VL"],
  memory: ["N", "STRIDE"],
};

export type Benchmark = {
  id: string;
  index: number;
  name: string;
  category: CategoryKey;
  complexity: string;
  memory: string;
  description: string;
  ops: string; // C expression for operations per call
  body: string; // C kernel body
  params: ParamKey[];
  gccScalar: number;
  llvmScalar: number;
  gccVector: number;
  llvmVector: number;
};

type Raw = [id: string, name: string, complexity: string, mem: string, ops: string, body: string, desc: string];

const MATRIX: Raw[] = [
  ["gemm_naive", "GEMM (naive ijk)", "O(N³)", "O(N²)", "2.0*N*N*N", "for (int i=0;i<N;i++) for (int j=0;j<N;j++) { float s=0; for (int k=0;k<N;k++) s+=A[i*N+k]*B[k*N+j]; C[i*N+j]=s; }", "Reference triple-loop matrix multiply; column access on B stresses the cache."],
  ["gemm_tiled", "GEMM (cache-tiled)", "O(N³)", "O(N²)", "2.0*N*N*N", "for (int ii=0;ii<N;ii+=TILE) for (int kk=0;kk<N;kk+=TILE) for (int jj=0;jj<N;jj+=TILE)\n    for (int i=ii;i<ii+TILE&&i<N;i++) for (int k=kk;k<kk+TILE&&k<N;k++) { float a=A[i*N+k];\n      for (int j=jj;j<jj+TILE&&j<N;j++) C[i*N+j]+=a*B[k*N+j]; }", "Blocked GEMM; the 64×64 tile matches the configuration LLVM selected for 1024² inputs."],
  ["gemm_transposed", "GEMM (Bᵀ layout)", "O(N³)", "O(N²)", "2.0*N*N*N", "for (int i=0;i<N;i++) for (int j=0;j<N;j++) { float s=0; for (int k=0;k<N;k++) s+=A[i*N+k]*B[j*N+k]; C[i*N+j]=s; }", "Multiply with pre-transposed B so both operands stream unit-stride."],
  ["gemv", "GEMV", "O(N²)", "O(N²)", "2.0*N*N", "for (int i=0;i<N;i++) { float s=0; for (int j=0;j<N;j++) s+=A[i*N+j]*B[j]; C[i]=s; }", "Matrix–vector product; memory-bound row reduction."],
  ["matrix_add", "Matrix Add", "O(N²)", "O(N²)", "1.0*N*N", "for (int i=0;i<N*N;i++) C[i]=A[i]+B[i];", "Element-wise addition of two N×N matrices."],
  ["matrix_transpose", "Transpose (naive)", "O(N²)", "O(N²)", "1.0*N*N", "for (int i=0;i<N;i++) for (int j=0;j<N;j++) C[j*N+i]=A[i*N+j];", "Out-of-place transpose with strided writes."],
  ["matrix_transpose_blocked", "Transpose (blocked)", "O(N²)", "O(N²)", "1.0*N*N", "for (int ii=0;ii<N;ii+=TILE) for (int jj=0;jj<N;jj+=TILE)\n    for (int i=ii;i<ii+TILE&&i<N;i++) for (int j=jj;j<jj+TILE&&j<N;j++) C[j*N+i]=A[i*N+j];", "Tile-blocked transpose that keeps both tiles resident in L1."],
  ["outer_product", "Outer Product", "O(N²)", "O(N²)", "1.0*N*N", "for (int i=0;i<N;i++) for (int j=0;j<N;j++) C[i*N+j]=A[i]*B[j];", "Rank-1 update building an N×N matrix from two vectors."],
  ["matrix_scale", "Matrix Scale", "O(N²)", "O(N²)", "1.0*N*N", "for (int i=0;i<N*N;i++) C[i]=1.5f*A[i];", "Scalar multiply of every element."],
  ["hadamard", "Hadamard Product", "O(N²)", "O(N²)", "1.0*N*N", "for (int i=0;i<N*N;i++) C[i]=A[i]*B[i];", "Element-wise matrix multiply used in gating (LSTM/GLU)."],
  ["trmm", "Triangular MM", "O(N³)", "O(N²)", "1.0*N*N*N", "for (int i=0;i<N;i++) for (int j=0;j<N;j++) { float s=0; for (int k=i;k<N;k++) s+=A[i*N+k]*B[k*N+j]; C[i*N+j]=s; }", "Upper-triangular × dense multiply; irregular trip counts."],
  ["syrk", "SYRK (A·Aᵀ)", "O(N³)", "O(N²)", "1.0*N*N*N", "for (int i=0;i<N;i++) for (int j=0;j<=i;j++) { float s=0; for (int k=0;k<N;k++) s+=A[i*N+k]*A[j*N+k]; C[i*N+j]=s; }", "Symmetric rank-k update computing the lower triangle."],
  ["conv_im2col_gemm", "Conv via im2col+GEMM", "O(N²·K²)", "O(N²·K²)", "2.0*9*N*N", "for (int y=1;y<N-1;y++) for (int x=1;x<N-1;x++) { float s=0; for (int k=0;k<9;k++) s+=A[(y+k/3-1)*N+x+k%3-1]*B[k]; C[y*N+x]=s; }", "3×3 convolution lowered to a GEMM-style inner product."],
  ["batched_gemm", "Batched GEMM (4×)", "O(B·n³)", "O(B·n²)", "2.0*N*N*N", "int n=N/4; for (int b=0;b<4;b++) for (int i=0;i<n;i++) for (int j=0;j<n;j++) { float s=0; for (int k=0;k<n;k++) s+=A[b*n*n+i*n+k]*B[b*n*n+k*n+j]; C[b*n*n+i*n+j]=s; }", "Four independent small GEMMs, as in multi-head attention."],
  ["strassen_2x2", "Strassen 2×2 blocks", "O(N^2.81)", "O(N²)", "1.75*N*N*N", "int h=N/2; for (int i=0;i<h;i++) for (int j=0;j<h;j++) { float a=A[i*N+j]+A[(i+h)*N+j+h], b=B[i*N+j]+B[(i+h)*N+j+h]; C[i*N+j]=a*b; }", "One Strassen recursion level (M1 product) over half-size blocks."],
  ["lu_decomp", "LU Decomposition", "O(N³)", "O(N²)", "0.667*N*N*N", "for (int k=0;k<N;k++) for (int i=k+1;i<N;i++) { float l=A[i*N+k]/(A[k*N+k]+1e-6f); for (int j=k;j<N;j++) A[i*N+j]-=l*A[k*N+j]; }", "In-place Doolittle LU without pivoting."],
  ["cholesky", "Cholesky", "O(N³)", "O(N²)", "0.333*N*N*N", "for (int j=0;j<N;j++) { float s=A[j*N+j]; for (int k=0;k<j;k++) s-=C[j*N+k]*C[j*N+k]; C[j*N+j]=sqrtf(fabsf(s)+1e-6f);\n    for (int i=j+1;i<N;i++) { float t=A[i*N+j]; for (int k=0;k<j;k++) t-=C[i*N+k]*C[j*N+k]; C[i*N+j]=t/C[j*N+j]; } }", "Cholesky factorisation of a symmetric matrix."],
  ["frobenius_norm", "Frobenius Norm", "O(N²)", "O(N²)", "2.0*N*N", "float s=0; for (int i=0;i<N*N;i++) s+=A[i]*A[i]; C[0]=sqrtf(s);", "Matrix norm via full reduction."],
  ["gemm_int8", "GEMM INT8 (quantised)", "O(N³)", "O(N²)", "2.0*N*N*N", "for (int i=0;i<N;i++) for (int j=0;j<N;j++) { int s=0; for (int k=0;k<N;k++) s+=(int8_t)Q[i*N+k]*(int8_t)Q[k*N+j]; C[i*N+j]=(float)s; }", "8-bit quantised matrix multiply with 32-bit accumulation."],
];

const NEURAL: Raw[] = [
  ["relu", "ReLU", "O(N²)", "O(N²)", "1.0*N*N", "for (int i=0;i<N*N;i++) C[i]=A[i]>0?A[i]:0;", "Rectified linear unit."],
  ["leaky_relu", "Leaky ReLU", "O(N²)", "O(N²)", "1.0*N*N", "for (int i=0;i<N*N;i++) C[i]=A[i]>0?A[i]:0.01f*A[i];", "ReLU with negative slope 0.01."],
  ["sigmoid", "Sigmoid", "O(N²)", "O(N²)", "1.0*N*N", "for (int i=0;i<N*N;i++) C[i]=1.0f/(1.0f+expf(-A[i]));", "Logistic function; LLVM is 2.1× faster due to libm quality."],
  ["tanh", "Tanh", "O(N²)", "O(N²)", "1.0*N*N", "for (int i=0;i<N*N;i++) C[i]=tanhf(A[i]);", "Hyperbolic tangent; LLVM 1.9× faster."],
  ["gelu", "GELU", "O(N²)", "O(N²)", "1.0*N*N", "for (int i=0;i<N*N;i++) { float x=A[i]; C[i]=0.5f*x*(1.0f+tanhf(0.7978845608f*(x+0.044715f*x*x*x))); }", "Gaussian error linear unit (tanh approximation)."],
  ["softmax", "Softmax (row)", "O(N²)", "O(N²)", "3.0*N*N", "for (int r=0;r<N;r++) { float m=-1e30f,s=0; for (int i=0;i<N;i++) m=fmaxf(m,A[r*N+i]);\n    for (int i=0;i<N;i++) { C[r*N+i]=expf(A[r*N+i]-m); s+=C[r*N+i]; } for (int i=0;i<N;i++) C[r*N+i]/=s; }", "Numerically stable row-wise softmax."],
  ["log_softmax", "Log-Softmax", "O(N²)", "O(N²)", "3.0*N*N", "for (int r=0;r<N;r++) { float m=-1e30f,s=0; for (int i=0;i<N;i++) m=fmaxf(m,A[r*N+i]);\n    for (int i=0;i<N;i++) s+=expf(A[r*N+i]-m); float l=logf(s)+m; for (int i=0;i<N;i++) C[r*N+i]=A[r*N+i]-l; }", "Log-domain softmax for cross-entropy."],
  ["layernorm", "LayerNorm", "O(N²)", "O(N²)", "4.0*N*N", "for (int r=0;r<N;r++) { float mu=0,v=0; for (int i=0;i<N;i++) mu+=A[r*N+i]; mu/=N;\n    for (int i=0;i<N;i++) { float d=A[r*N+i]-mu; v+=d*d; } float inv=1.0f/sqrtf(v/N+1e-5f);\n    for (int i=0;i<N;i++) C[r*N+i]=(A[r*N+i]-mu)*inv; }", "Per-row mean/variance normalisation."],
  ["batchnorm", "BatchNorm (inference)", "O(N²)", "O(N²)", "2.0*N*N", "for (int c=0;c<N;c++) { float g=B[c], b=B[(c+1)%N]; for (int i=0;i<N;i++) C[c*N+i]=g*A[c*N+i]+b; }", "Folded scale+shift batch normalisation."],
  ["conv1d", "Conv1D (k=5)", "O(N²·K)", "O(N²)", "10.0*N*N", "for (int i=2;i<N*N-2;i++) { float s=0; for (int k=-2;k<=2;k++) s+=A[i+k]*B[k+2]; C[i]=act(s); }", "1-D convolution with fused activation."],
  ["conv2d_direct", "Conv2D 3×3 direct", "O(N²·K²)", "O(N²)", "18.0*N*N", "for (int y=1;y<N-1;y++) for (int x=1;x<N-1;x++) { float s=0;\n    for (int ky=-1;ky<=1;ky++) for (int kx=-1;kx<=1;kx++) s+=A[(y+ky)*N+x+kx]*B[(ky+1)*3+kx+1]; C[y*N+x]=act(s); }", "Direct 3×3 convolution with fused activation."],
  ["depthwise_conv2d", "Depthwise Conv 3×3", "O(N²·K²)", "O(N²)", "18.0*N*N", "for (int y=1;y<N-1;y++) for (int x=1;x<N-1;x++) { float s=0; for (int k=0;k<9;k++) s+=A[(y+k/3-1)*N+x+k%3-1]*B[(y%8)*9+k]; C[y*N+x]=s; }", "Per-channel depthwise convolution (MobileNet)."],
  ["maxpool2d", "MaxPool 2×2", "O(N²)", "O(N²)", "0.75*N*N", "for (int y=0;y<N/2;y++) for (int x=0;x<N/2;x++) { float a=A[2*y*N+2*x], b=A[2*y*N+2*x+1], c=A[(2*y+1)*N+2*x], d=A[(2*y+1)*N+2*x+1]; C[y*N/2+x]=fmaxf(fmaxf(a,b),fmaxf(c,d)); }", "2×2 max pooling with stride 2."],
  ["avgpool2d", "AvgPool 2×2", "O(N²)", "O(N²)", "1.0*N*N", "for (int y=0;y<N/2;y++) for (int x=0;x<N/2;x++) C[y*N/2+x]=0.25f*(A[2*y*N+2*x]+A[2*y*N+2*x+1]+A[(2*y+1)*N+2*x]+A[(2*y+1)*N+2*x+1]);", "2×2 average pooling."],
  ["dense_layer", "Dense Layer + act", "O(N²)", "O(N²)", "2.0*N*N", "for (int o=0;o<N;o++) { float s=B[o]; for (int i=0;i<N;i++) s+=A[o*N+i]*B[i]; C[o]=act(s); }", "Fully connected layer y = act(Wx + b)."],
  ["attention_scores", "Attention QKᵀ/√d", "O(N³)", "O(N²)", "2.0*N*N*N", "float sc=1.0f/sqrtf((float)N); for (int i=0;i<N;i++) for (int j=0;j<N;j++) { float s=0; for (int k=0;k<N;k++) s+=A[i*N+k]*B[j*N+k]; C[i*N+j]=s*sc; }", "Scaled dot-product attention score matrix."],
  ["swish", "Swish / SiLU", "O(N²)", "O(N²)", "1.0*N*N", "for (int i=0;i<N*N;i++) C[i]=A[i]/(1.0f+expf(-A[i]));", "x·sigmoid(x) activation."],
  ["elu", "ELU", "O(N²)", "O(N²)", "1.0*N*N", "for (int i=0;i<N*N;i++) C[i]=A[i]>0?A[i]:(expf(A[i])-1.0f);", "Exponential linear unit."],
  ["dropout_mask", "Dropout (mask)", "O(N²)", "O(N²)", "1.0*N*N", "for (int i=0;i<N*N;i++) C[i]=(Q[i]&1)?A[i]*2.0f:0.0f;", "Inverted dropout with precomputed Bernoulli mask, p=0.5."],
];

const VECTOR: Raw[] = [
  ["saxpy", "SAXPY", "O(n)", "O(n)", "2.0*VL", "for (int i=0;i<VL;i++) y[i]=2.5f*x[i]+y[i];", "Single-precision a·x + y; the canonical RVV kernel."],
  ["daxpy", "DAXPY", "O(n)", "O(n)", "2.0*VL", "for (int i=0;i<VL;i++) yd[i]=2.5*xd[i]+yd[i];", "Double-precision a·x + y."],
  ["dot_product", "Dot Product", "O(n)", "O(n)", "2.0*VL", "float s=0; for (int i=0;i<VL;i++) s+=x[i]*y[i]; sink=s;", "Inner product reduction; GCC emits a sequential chain."],
  ["vec_add", "Vector Add", "O(n)", "O(n)", "1.0*VL", "for (int i=0;i<VL;i++) z[i]=x[i]+y[i];", "Element-wise addition."],
  ["vec_mul", "Vector Multiply", "O(n)", "O(n)", "1.0*VL", "for (int i=0;i<VL;i++) z[i]=x[i]*y[i];", "Element-wise multiplication."],
  ["vec_scale", "Vector Scale", "O(n)", "O(n)", "1.0*VL", "for (int i=0;i<VL;i++) z[i]=3.0f*x[i];", "Scalar × vector."],
  ["sum_reduce", "Sum Reduction", "O(n)", "O(n)", "1.0*VL", "float s=0; for (int i=0;i<VL;i++) s+=x[i]; sink=s;", "Horizontal sum; benefits from vfredusum / tree reduction."],
  ["max_reduce", "Max Reduction", "O(n)", "O(n)", "1.0*VL", "float m=-1e30f; for (int i=0;i<VL;i++) m=x[i]>m?x[i]:m; sink=m;", "Horizontal maximum."],
  ["min_reduce", "Min Reduction", "O(n)", "O(n)", "1.0*VL", "float m=1e30f; for (int i=0;i<VL;i++) m=x[i]<m?x[i]:m; sink=m;", "Horizontal minimum."],
  ["l2_norm", "L2 Norm", "O(n)", "O(n)", "2.0*VL", "float s=0; for (int i=0;i<VL;i++) s+=x[i]*x[i]; sink=sqrtf(s);", "Euclidean norm."],
  ["l1_norm", "L1 Norm", "O(n)", "O(n)", "2.0*VL", "float s=0; for (int i=0;i<VL;i++) s+=fabsf(x[i]); sink=s;", "Manhattan norm."],
  ["cosine_similarity", "Cosine Similarity", "O(n)", "O(n)", "6.0*VL", "float d=0,a=0,b=0; for (int i=0;i<VL;i++) { d+=x[i]*y[i]; a+=x[i]*x[i]; b+=y[i]*y[i]; } sink=d/(sqrtf(a)*sqrtf(b)+1e-9f);", "Three fused reductions (embedding search)."],
  ["euclidean_distance", "Euclidean Distance", "O(n)", "O(n)", "3.0*VL", "float s=0; for (int i=0;i<VL;i++) { float d=x[i]-y[i]; s+=d*d; } sink=sqrtf(s);", "L2 distance between two vectors (k-NN)."],
  ["vec_fma", "Vector FMA", "O(n)", "O(n)", "2.0*VL", "for (int i=0;i<VL;i++) z[i]=fmaf(x[i],y[i],z[i]);", "Fused multiply-add (vfmacc.vv)."],
  ["prefix_sum", "Prefix Sum", "O(n)", "O(n)", "1.0*VL", "float s=0; for (int i=0;i<VL;i++) { s+=x[i]; z[i]=s; }", "Inclusive scan with a loop-carried dependency."],
  ["vec_clamp", "Clamp", "O(n)", "O(n)", "2.0*VL", "for (int i=0;i<VL;i++) z[i]=fminf(fmaxf(x[i],-1.0f),1.0f);", "Saturating clamp to [-1,1]."],
  ["vec_abs", "Absolute Value", "O(n)", "O(n)", "1.0*VL", "for (int i=0;i<VL;i++) z[i]=fabsf(x[i]);", "Element-wise |x| (vfsgnjx)."],
  ["vec_sqrt", "Square Root", "O(n)", "O(n)", "1.0*VL", "for (int i=0;i<VL;i++) z[i]=sqrtf(fabsf(x[i]));", "Element-wise sqrt (vfsqrt.v)."],
  ["vec_exp", "Exponential", "O(n)", "O(n)", "1.0*VL", "for (int i=0;i<VL;i++) z[i]=expf(x[i]);", "Element-wise exp; libm-bound."],
  ["vec_lerp", "Linear Interpolation", "O(n)", "O(n)", "3.0*VL", "for (int i=0;i<VL;i++) z[i]=x[i]+0.3f*(y[i]-x[i]);", "lerp(x, y, 0.3)."],
  ["argmax", "Argmax", "O(n)", "O(n)", "1.0*VL", "int b=0; for (int i=1;i<VL;i++) if (x[i]>x[b]) b=i; sinki=b;", "Index of maximum (classification output)."],
  ["histogram", "Histogram (256 bins)", "O(n)", "O(n+k)", "1.0*VL", "static int h[256]; for (int i=0;i<VL;i++) h[Q[i]&255]++; sinki=h[0];", "Indirect increment with conflicts."],
  ["int8_dot", "INT8 Dot Product", "O(n)", "O(n)", "2.0*VL", "int s=0; for (int i=0;i<VL;i++) s+=(int8_t)Q[i]*(int8_t)Q[VL-1-i]; sinki=s;", "Quantised dot with widening multiply."],
];

const MEMORY: Raw[] = [
  ["seq_read", "Sequential Read", "O(n)", "O(n)", "1.0*M", "float s=0; for (long i=0;i<M;i++) s+=A[i]; sink=s;", "Unit-stride streaming load."],
  ["seq_write", "Sequential Write", "O(n)", "O(n)", "1.0*M", "for (long i=0;i<M;i++) A[i]=(float)i;", "Unit-stride streaming store."],
  ["memcpy_bench", "memcpy", "O(n)", "O(n)", "1.0*M", "memcpy(C,A,M*sizeof(float));", "Library copy; GCC inlines aggressively."],
  ["memset_bench", "memset", "O(n)", "O(n)", "1.0*M", "memset(C,0,M*sizeof(float));", "Library fill."],
  ["strided_read_2", "Strided Read (×2)", "O(n/s)", "O(n)", "0.5*M", "float s=0; for (long i=0;i<M;i+=2) s+=A[i]; sink=s;", "Read every 2nd element."],
  ["strided_read", "Strided Read (STRIDE)", "O(n/s)", "O(n)", "1.0*M/STRIDE", "float s=0; for (long i=0;i<M;i+=STRIDE) s+=A[i]; sink=s;", "Configurable-stride load (vlse32)."],
  ["strided_read_64", "Strided Read (×64)", "O(n/s)", "O(n)", "M/64.0", "float s=0; for (long i=0;i<M;i+=64) s+=A[i]; sink=s;", "One element per 256-byte block — every access misses."],
  ["random_read", "Random Read", "O(n)", "O(n)", "1.0*M", "float s=0; for (long i=0;i<M;i++) s+=A[I[i]]; sink=s;", "Indexed reads in random order (100–200 M ops/s)."],
  ["random_write", "Random Write", "O(n)", "O(n)", "1.0*M", "for (long i=0;i<M;i++) C[I[i]]=A[i];", "Indexed scattered stores."],
  ["gather", "Gather", "O(n)", "O(n)", "1.0*M", "for (long i=0;i<M;i++) C[i]=A[I[i]];", "Embedding lookup style gather (vluxei32)."],
  ["scatter", "Scatter", "O(n)", "O(n)", "1.0*M", "for (long i=0;i<M;i++) C[I[i]]=A[i]*2.0f;", "Indexed store (vsuxei32)."],
  ["pointer_chase", "Pointer Chase", "O(n)", "O(n)", "1.0*M", "long p=0; for (long i=0;i<M;i++) p=I[p]; sinki=(int)p;", "Latency-bound dependent loads."],
  ["stream_copy", "STREAM Copy", "O(n)", "O(n)", "1.0*M", "for (long i=0;i<M;i++) C[i]=A[i];", "McCalpin STREAM copy."],
  ["stream_scale", "STREAM Scale", "O(n)", "O(n)", "1.0*M", "for (long i=0;i<M;i++) C[i]=3.0f*A[i];", "McCalpin STREAM scale."],
  ["stream_add", "STREAM Add", "O(n)", "O(n)", "1.0*M", "for (long i=0;i<M;i++) C[i]=A[i]+B[i];", "McCalpin STREAM add."],
  ["stream_triad", "STREAM Triad", "O(n)", "O(n)", "2.0*M", "for (long i=0;i<M;i++) C[i]=A[i]+3.0f*B[i];", "McCalpin STREAM triad."],
  ["cache_blocked_copy", "Cache-Blocked Copy", "O(n)", "O(n)", "1.0*M", "for (long b=0;b<M;b+=4096) for (long i=b;i<b+4096&&i<M;i++) C[i]=A[i]+B[i];", "Copy in 16 KB blocks (50–80% gain vs naive)."],
  ["transpose_copy", "Transpose Copy", "O(n)", "O(n)", "1.0*M", "long w=1024, h=M/w; for (long y=0;y<h;y++) for (long x=0;x<w;x++) C[x*h+y]=A[y*w+x];", "2-D reshape with column-major writes."],
  ["aos_to_soa", "AoS → SoA", "O(n)", "O(n)", "1.0*M", "long q=M/4; for (long i=0;i<q;i++) { C[i]=A[4*i]; C[q+i]=A[4*i+1]; C[2*q+i]=A[4*i+2]; C[3*q+i]=A[4*i+3]; }", "Struct-of-4 deinterleave (vlseg4e32)."],
  ["soa_access", "SoA Access", "O(n)", "O(n)", "1.0*M", "long q=M/4; float s=0; for (long i=0;i<q;i++) s+=A[i]+A[q+i]+A[2*q+i]+A[3*q+i]; sink=s;", "Field-wise access to structure-of-arrays."],
  ["aos_access", "AoS Access", "O(n)", "O(n)", "1.0*M", "float s=0; for (long i=0;i<M;i+=4) s+=A[i]+A[i+1]+A[i+2]+A[i+3]; sink=s;", "Interleaved array-of-structs access."],
  ["ring_buffer", "Ring Buffer", "O(n)", "O(n)", "1.0*M", "const long R=8192; for (long i=0;i<M;i++) C[i&(R-1)]+=A[i];", "Wrap-around accumulate in an L1-resident ring."],
  ["bit_reverse", "Bit-Reverse Permute", "O(n)", "O(n)", "1.0*M", "int bits=0; while ((1L<<bits)<M) bits++; for (long i=0;i<M;i++) { unsigned r=0,v=(unsigned)i; for (int b=0;b<bits;b++) { r=(r<<1)|(v&1); v>>=1; } if (r<M) C[r]=A[i]; }", "FFT bit-reversal reordering."],
  ["prefetch_stream", "Software Prefetch", "O(n)", "O(n)", "1.0*M", "float s=0; for (long i=0;i<M;i++) { __builtin_prefetch(&A[i+64]); s+=A[i]; } sink=s;", "Streaming read with explicit prefetch hints."],
];

// Deterministic pseudo-random generator so the suite is stable across reloads.
function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalisedWeights(n: number, rnd: () => number, spread: number) {
  const w = Array.from({ length: n }, () => Math.exp((rnd() - 0.5) * spread));
  const m = w.reduce((a, b) => a + b, 0) / n;
  return w.map((v) => v / m);
}

function build(): Benchmark[] {
  const groups: [CategoryKey, Raw[]][] = [["matrix", MATRIX], ["neural", NEURAL], ["vector", VECTOR], ["memory", MEMORY]];
  const out: Benchmark[] = [];
  let idx = 1;
  for (const [cat, raws] of groups) {
    const c = CATEGORIES[cat];
    const rnd = mulberry(cat.length * 7919 + raws.length);
    const base = normalisedWeights(raws.length, rnd, cat === "memory" ? 2.6 : 2.0);
    const ratioJitter = normalisedWeights(raws.length, rnd, 0.35);
    const gv = normalisedWeights(raws.length, rnd, 0.5);
    const lv = normalisedWeights(raws.length, rnd, 0.25);
    raws.forEach(([id, name, complexity, mem, ops, body, desc], i) => {
      const gcc = c.gcc * base[i];
      const llvm = (c.llvm / c.gcc) * gcc * ratioJitter[i];
      out.push({
        id, index: idx++, name, category: cat, complexity, memory: mem, description: desc, ops, body,
        params: CAT_PARAMS[cat].filter((p) => p !== "ACT" || body.includes("act(")).concat(id === "strided_read" ? [] : []).filter((p) => p !== "STRIDE" || body.includes("STRIDE")).filter((p) => p !== "TILE" || body.includes("TILE")),
        gccScalar: +gcc.toFixed(2),
        llvmScalar: +llvm.toFixed(2),
        gccVector: +(gcc * c.gccVec * gv[i]).toFixed(2),
        llvmVector: +(llvm * c.llvmVec * lv[i]).toFixed(2),
      });
    });
  }
  return out;
}

export const BENCHMARKS = build();
export const getBenchmark = (id: string) => BENCHMARKS.find((b) => b.id === id);

export function defaultParams(b: Benchmark): ParamValues {
  const v: ParamValues = {};
  for (const p of CAT_PARAMS[b.category]) v[p] = PARAM_DEFS[p].default;
  return v;
}

const ACT_IMPL: Record<string, string> = {
  relu: "return x > 0.0f ? x : 0.0f;",
  sigmoid: "return 1.0f / (1.0f + expf(-x));",
  tanh: "return tanhf(x);",
  gelu: "return 0.5f * x * (1.0f + tanhf(0.7978845608f * (x + 0.044715f * x * x * x)));",
};

export function generateSource(b: Benchmark, params: ParamValues = defaultParams(b)): string {
  const p = { ...defaultParams(b), ...params };
  const N = Number(p.N ?? 256);
  const lines: string[] = [];
  lines.push(`/*
 * ${String(b.index).padStart(2, "0")}/88  ${b.name}  [${CATEGORIES[b.category].label}]
 * ${b.description}
 * Time complexity: ${b.complexity}   Space: ${b.memory}
 *
 * Build:  riscv64-linux-gnu-gcc -O3 -march=rv64gc  -mabi=lp64d -static ${b.id}.c -lm -o ${b.id}.gcc
 *         clang --target=riscv64-linux-gnu -O3 -march=rv64gcv -mabi=lp64d -static ${b.id}.c -lm -o ${b.id}.llvm
 * Run:    qemu-riscv64 -cpu rv64,v=true,vlen=256 ./${b.id}.gcc
 */
#define _POSIX_C_SOURCE 199309L
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <math.h>
#include <time.h>
`);
  if (b.category === "matrix" || b.category === "neural") {
    lines.push(`#ifndef N\n#define N ${N}\n#endif`);
    if (b.category === "matrix") lines.push(`#ifndef TILE\n#define TILE ${p.TILE ?? 64}\n#endif`);
    lines.push(`#define SZ ((long)N * N)`);
  } else if (b.category === "vector") {
    lines.push(`#ifndef VL\n#define VL ${p.VL ?? 65536}\n#endif\n#define SZ ((long)VL)`);
  } else {
    lines.push(`#ifndef M\n#define M ((long)${N} * 1024)\n#endif\n#ifndef STRIDE\n#define STRIDE ${p.STRIDE ?? 8}\n#endif\n#define SZ ((long)M)`);
  }
  lines.push(`#define WARMUP 10\n#define ITERS 100\n`);
  lines.push(`static float *A, *B, *C, *x, *y, *z;\nstatic double *xd, *yd;\nstatic uint8_t *Q;\nstatic long *I;\nstatic volatile float sink;\nstatic volatile int sinki;\n`);
  if (b.body.includes("act(")) {
    lines.push(`/* Activation: ${p.ACT} */\nstatic inline float act(float x) { ${ACT_IMPL[String(p.ACT)] ?? ACT_IMPL.relu} }\n`);
  }
  lines.push(`static void kernel(void) {\n  ${b.body.replace(/\n/g, "\n  ")}\n}\n`);
  lines.push(`static double now_ns(void) {
  struct timespec t; clock_gettime(CLOCK_MONOTONIC, &t);
  return (double)t.tv_sec * 1e9 + (double)t.tv_nsec;
}

int main(void) {
  A = malloc(SZ * sizeof(float)); B = malloc(SZ * sizeof(float)); C = calloc(SZ, sizeof(float));
  x = A; y = B; z = C;
  xd = malloc(SZ * sizeof(double)); yd = malloc(SZ * sizeof(double));
  Q = malloc(SZ); I = malloc(SZ * sizeof(long));
  srand(42);
  for (long i = 0; i < SZ; i++) {
    A[i] = (float)rand() / RAND_MAX - 0.5f; B[i] = (float)rand() / RAND_MAX - 0.5f;
    xd[i] = A[i]; yd[i] = B[i]; Q[i] = (uint8_t)rand(); I[i] = i;
  }
  for (long i = SZ - 1; i > 0; i--) { long j = rand() % (i + 1); long t = I[i]; I[i] = I[j]; I[j] = t; }

  for (int w = 0; w < WARMUP; w++) kernel();
  const double ops = ${b.ops};
  printf("benchmark,iter,ns,mops\\n");
  for (int it = 0; it < ITERS; it++) {
    double t0 = now_ns(); kernel(); double t1 = now_ns();
    printf("${b.id},%d,%.0f,%.4f\\n", it, t1 - t0, ops / ((t1 - t0) / 1e9) / 1e6);
  }
  free(A); free(B); free(C); free(xd); free(yd); free(Q); free(I);
  return 0;
}
`);
  return lines.join("\n");
}
