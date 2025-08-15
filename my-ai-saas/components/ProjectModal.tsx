"use client";

import { useEffect, useState } from "react";

export default function ProjectModal({
	isOpen,
	onClose,
	onConfirmNew,
	onConfirmExisting,
	initialTitle,
	hasExisting,
	existingTitle,
	dark,
}: {
	isOpen: boolean;
	onClose: () => void;
	onConfirmNew: (title: string) => void;
	onConfirmExisting?: () => void;
	initialTitle?: string;
	hasExisting?: boolean;
	existingTitle?: string;
	dark?: boolean;
}) {
	const [title, setTitle] = useState(initialTitle || "");
	useEffect(() => { if (isOpen) setTitle(initialTitle || ""); }, [isOpen, initialTitle]);
	if (!isOpen) return null;
	return (
		<div className="fixed inset-0 z-[10050]">
			<div className="absolute inset-0 bg-black/60" onClick={onClose} />
			<div className={`absolute left-1/2 top-20 w-[92vw] max-w-md -translate-x-1/2 rounded-2xl border p-4 shadow-2xl ${dark ? 'bg-neutral-950 border-neutral-800 text-neutral-100' : 'bg-white'}`}>
				<div className="mb-3 text-sm font-semibold">Save Project</div>
				{hasExisting ? (
					<div className="mb-4 rounded border p-2 text-xs">
						<div className="mb-1 font-medium">Save options</div>
						<div className="flex flex-col gap-2">
							<button
								className={`rounded border px-3 py-2 text-left ${dark ? 'border-neutral-700 hover:bg-neutral-800' : 'hover:bg-black/5'}`}
								onClick={()=> { onConfirmExisting && onConfirmExisting(); }}
							>
								Continue saving to existing project{existingTitle ? `: ${existingTitle}` : ''}
							</button>
							<div className="opacity-70">Or save a copy as a new project:</div>
						</div>
					</div>
				) : null}
				<label className="mb-1 block text-xs opacity-70">Save as (project title)</label>
				<input
					className={`mb-3 w-full rounded border px-3 py-2 text-sm ${dark ? 'bg-neutral-900 border-neutral-700 text-neutral-100 placeholder-neutral-500' : ''}`}
					placeholder="My Project"
					value={title}
					onChange={(e)=> setTitle(e.target.value)}
				/>
				<div className="mt-4 flex justify-end gap-2">
					<button className={`rounded border px-3 py-1 text-sm ${dark ? 'border-neutral-700' : ''}`} onClick={onClose}>Cancel</button>
					<button
						className={`rounded border px-3 py-1 text-sm ${dark ? 'border-neutral-700 bg-neutral-800' : 'bg-black text-white'}`}
						onClick={()=> { const t = (title||'').trim() || 'Untitled Project'; onConfirmNew(t); }}
					>Save As</button>
				</div>
			</div>
		</div>
	);
}


