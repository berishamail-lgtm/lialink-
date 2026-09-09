export default function ConfirmPage() {
  return (
    <div className="min-h-screen bg-[#0f0e0d] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md text-center">
        <div className="text-5xl mb-4">📧</div>
        <h1 className="text-2xl font-bold mb-2">Kolla din e-post!</h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          Vi har skickat en bekräftelselänk till din e-postadress.
          Klicka på länken för att aktivera ditt konto.
        </p>
        <a href="/login" className="inline-block mt-6 bg-[#0f0e0d] text-white rounded-full px-8 py-3 font-bold text-sm hover:opacity-80 transition">
          Tillbaka till inloggning
        </a>
      </div>
    </div>
  )
}