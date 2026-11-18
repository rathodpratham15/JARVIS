import { useParams } from 'react-router-dom';
import { useJarvisStore } from '../store/useJarvisStore';
import { ChatWorkspace } from './ChatWorkspace';

export function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const { projects } = useJarvisStore();
  const project = projects.find((p) => p.id === id);

  return (
    <div className="flex flex-col h-full">
      {project && (
        <div className="px-4 py-2 border-b border-[#E5E5E5] dark:border-white/10 text-xs text-[#717171] dark:text-[#A1A1AA] flex items-center gap-2 shrink-0">
          <span>Project:</span>
          <span className="font-medium text-[#171717] dark:text-[#F5F5F5]">{project.name}</span>
        </div>
      )}
      <ChatWorkspace />
    </div>
  );
}
