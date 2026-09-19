export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 900:'#0B1020', 800:'#131A2E', 700:'#1C2540', 600:'#263154' },
        saffron: { 50:'#FFF7ED', 100:'#FFEDD5', 400:'#FB923C', 500:'#F97316', 600:'#EA580C' },
        leaf: { 50:'#ECFDF5', 400:'#34D399', 500:'#10B981', 600:'#059669' },
        royal: { 50:'#EEF2FF', 400:'#818CF8', 500:'#6366F1', 600:'#4F46E5' },
      },
      fontFamily: { sans: ['Inter','ui-sans-serif','system-ui','sans-serif'] },
      boxShadow: { soft:'0 1px 2px rgba(16,24,40,.06),0 1px 3px rgba(16,24,40,.1)', lift:'0 10px 30px -12px rgba(16,24,40,.25)' },
    },
  },
  plugins: [],
}
