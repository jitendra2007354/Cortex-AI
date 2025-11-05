import React, { useState } from 'react';
import { CreditCardIcon, XIcon, CheckIcon } from './Icons';

interface BuyPlanProps {
    onClose: () => void;
}

const BuyPlan: React.FC<BuyPlanProps> = ({ onClose }) => {
    const [view, setView] = useState('details'); // 'details' or 'payment'

    if (view === 'payment') {
        return (
             <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-md w-full shadow-2xl relative animate-in fade-in-0 zoom-in-95">
                     <button onClick={onClose} className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-700 transition-colors">
                        <XIcon />
                    </button>
                    <h2 className="text-2xl font-bold text-white text-center">Complete Your Payment</h2>
                    <p className="text-zinc-400 mt-2 text-center">You will be redirected to PayPal to complete your payment for the Cortex AI Personal Plan.</p>

                    <div className="mt-8">
                        <a
                            href="https://paypal.me/cortexai873"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full inline-block text-center py-3 px-4 rounded-lg bg-yellow-500 text-zinc-900 font-bold hover:bg-yellow-600 transition-colors"
                        >
                            Pay with PayPal
                        </a>
                    </div>
                    
                    <div className="mt-8 text-center text-sm text-zinc-300 space-y-2">
                        <p><span className="font-semibold">Important:</span> Your Cortex AI plan will be linked to your PayPal account email.</p>
                        <p className="text-zinc-400">Activation may take up to 24 hours. You will receive a confirmation email with a Paid Key to activate your Subscription.</p>
                    </div>

                    <div className="mt-6 flex justify-center gap-4">
                        <button onClick={() => setView('details')} className="px-6 py-2 rounded-lg bg-zinc-700 text-white font-semibold hover:bg-zinc-600 transition-colors">
                            Back
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const features = [
        "Up to 5000 messages/month",
        "Up to 200 image generations/month",
        "Up to 100 video generations/month",
        "Higher rate limits",
        "Priority support",
        "Early access to new features"
    ];

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-lg w-full shadow-2xl relative animate-in fade-in-0 zoom-in-95">
                <button onClick={onClose} className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-700 transition-colors">
                    <XIcon />
                </button>
                <div className="text-center">
                    <div className="inline-block p-4 bg-blue-600/20 rounded-full border border-blue-500/50 text-blue-400">
                        <CreditCardIcon />
                    </div>
                    <h2 className="text-3xl font-bold text-white mt-4">Personal Plan</h2>
                    <p className="text-zinc-400 mt-1">Unlock the full potential of Cortex AI.</p>
                </div>

                <div className="mt-6 text-center">
                    <p className="text-5xl font-bold text-white">$60<span className="text-2xl font-medium text-zinc-400">/month</span></p>
                </div>
                
                <ul className="mt-6 space-y-2.5">
                    {features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-3">
                            <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center bg-green-500/20 rounded-full text-green-400">
                                <CheckIcon />
                            </div>
                            <span className="text-zinc-300">{feature}</span>
                        </li>
                    ))}
                </ul>

                <div className="mt-8 flex flex-col items-center gap-4">
                    <button onClick={() => setView('payment')} className="w-full text-center px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors">
                        Proceed to Payment
                    </button>
                     <button onClick={onClose} className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                        Maybe later
                    </button>
                </div>
            </div>
        </div>
    );
};

export default React.memo(BuyPlan);